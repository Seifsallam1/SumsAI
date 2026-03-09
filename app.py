import os
import io
import fitz  # PyMuPDF
import google.generativeai as genai
from flask import Flask, render_template, request, jsonify, send_from_directory, abort, make_response
from PIL import Image
from config import Config
from datetime import datetime

SITE_URL = os.getenv("SITE_URL", "/")

app = Flask(__name__, template_folder="templates", static_folder="static")

# --- الإعدادات ---
ALLOWED_EXTENSIONS_IMG = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'}
ALLOWED_EXTENSIONS_PDF = {'pdf'}
MAX_IMAGE_COUNT = 10
MAX_PDF_PAGES = 20

# مسار فولدر المكتبة
LIBRARY_FOLDER = os.path.join(app.root_path, 'static', 'library')

if not os.path.exists(LIBRARY_FOLDER):
    os.makedirs(LIBRARY_FOLDER)

@app.context_processor
def inject_site_url():
    return dict(SITE_URL=SITE_URL)

# --- إعداد Gemini AI ---
genai.configure(api_key=Config.GEMINI_API_KEY)
model = genai.GenerativeModel(
    model_name=Config.MODEL["model_name"],
    system_instruction=Config.SYSTEM["instructions"]
)

# --- Helper Functions ---
def allowed_file(filename, allowed_extensions):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions

def validate_input(text, files):
    if not text.strip() and not files:
        return False, "Please provide some text or upload a file."
    if len(text) > 16000:
        return False, "Input text is too long. Max 16,000 chars."
    return True, "Valid"

def generate_summary(content_parts):
    if not Config.GEMINI_API_KEY:
        return "---Model Format Error---\nAPI_KEY: Error! Key is missing."
    generation_config = genai.types.GenerationConfig(temperature=Config.MODEL["temperature"])
    response = model.generate_content(content_parts, generation_config=generation_config)
    return response.text

# -----------------------------------------------------------
# --- مكتبة التلخيصات (Library Routes) - النسخة المتطورة ---
# -----------------------------------------------------------

@app.route('/library')
def library_index():
    """الصفحة الرئيسية للمكتبة - تعرض الأقسام (المجلدات)"""
    if not os.path.exists(LIBRARY_FOLDER):
        os.makedirs(LIBRARY_FOLDER)

    sections = []
    try:
        for item in os.listdir(LIBRARY_FOLDER):
            item_path = os.path.join(LIBRARY_FOLDER, item)
            if os.path.isdir(item_path):
                sections.append(item)
    except:
        pass

    return render_template('library.html', sections=sections)

@app.route('/library/<section>')
def library_section(section):
    """صفحة القسم - تعرض كل التلخيصات (ملفات HTML) في هذا القسم"""
    section_path = os.path.join(LIBRARY_FOLDER, section)
    if not os.path.exists(section_path) or not os.path.isdir(section_path):
        abort(404)  # القسم غير موجود

    lessons = []
    for file in os.listdir(section_path):
        if file.endswith('.html'):
            lessons.append(file[:-5])  # إزالة .html
    return render_template('library_section.html', section=section, lessons=lessons)

@app.route('/library/<section>/<lesson>')
def library_lesson(section, lesson):
    """صفحة التلخيص الفردي - تعرض ملف HTML المحدد"""
    lesson_path = os.path.join(LIBRARY_FOLDER, section)
    lesson_file = f"{lesson}.html"
    if not os.path.exists(os.path.join(lesson_path, lesson_file)):
        abort(404)
    return send_from_directory(lesson_path, lesson_file)

# -----------------------------------------------------------
# --- الروتس الأساسية للموقع (الصفحة الرئيسية والتلخيص المباشر) ---
# -----------------------------------------------------------

@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        lesson_text = request.form.get("lesson_text", "").strip()
        input_type = request.form.get("input_type", "text")
        error_message = None
        content_parts = []

        if lesson_text:
            content_parts.append(lesson_text)

        if input_type in ["pdf", "image"]:
            files = request.files.getlist('file')
            if not files or files[0].filename == '':
                error_message = "No file selected."

            elif input_type == "pdf":
                file = files[0]
                if file and allowed_file(file.filename, ALLOWED_EXTENSIONS_PDF):
                    try:
                        pdf_bytes = file.read()
                        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
                        num_pages = len(doc)
                        if num_pages > MAX_PDF_PAGES:
                            error_message = f"PDF is too long ({num_pages} pages). Max is {MAX_PDF_PAGES}."
                        else:
                            content_parts.append({"mime_type": "application/pdf", "data": pdf_bytes})
                    except Exception as e:
                        error_message = "Error processing PDF."
                else:
                    error_message = "Invalid file type. Please upload a PDF."

            elif input_type == "image":
                if len(files) > MAX_IMAGE_COUNT:
                    error_message = f"Max {MAX_IMAGE_COUNT} images allowed."
                else:
                    for file in files:
                        if file and allowed_file(file.filename, ALLOWED_EXTENSIONS_IMG):
                            try:
                                image = Image.open(file.stream)
                                content_parts.append(image)
                            except:
                                error_message = "Error processing images."
                                break

        if error_message:
            return f"<div style='padding:20px; color:#D32F2F;'><h3>Error</h3><p>{error_message}</p></div>", 400

        try:
            raw_summary = generate_summary(content_parts)
            parts = raw_summary.split('---', 1)
            if len(parts) != 2:
                if '---' in raw_summary:
                    parts = raw_summary.split('---', 2)[1:]
                else:
                    return "Model Format Error", 500

            meta_lines, html_content = parts
            meta_data = {}
            for line in meta_lines.strip().split('\n'):
                if ':' in line:
                    key, value = line.split(':', 1)
                    meta_data[key.strip().lower()] = value.strip().strip('"')

            return render_template(
                "summary_template.html",
                title=meta_data.get("topic_title", "Lesson Summary"),
                lang=meta_data.get("language", "en"),
                dir=meta_data.get("direction", "ltr"),
                font=meta_data.get("font", "Baloo 2"),
                content=html_content.strip()
            )
        except Exception as e:
            return f"Error: {str(e)}", 500

    return render_template("index.html")

# --- Health check & SEO ---
@app.route(Config.ROUTES.get("health_check", "/health"))
def health_check():
    return jsonify({"status": "ok"}), 200

@app.route("/robots.txt")
def robots_txt():
    return send_from_directory("static", "robots.txt")


@app.route("/sitemap.xml")
def sitemap_xml():
    pages = []
    # هنا بنضمن إن الرابط دايمًا آخره شرطة مائلة عشان الروابط ما تلزقش في بعض
    base_url = SITE_URL if SITE_URL.endswith('/') else f"{SITE_URL}/"

    # الصفحة الرئيسية والمكتبة
    pages.append([base_url, "1.0"])
    pages.append([f"{base_url}library", "0.8"])

    # إضافة الأقسام والدروس تلقائيًا
    if os.path.exists(LIBRARY_FOLDER):
        for section in os.listdir(LIBRARY_FOLDER):
            section_path = os.path.join(LIBRARY_FOLDER, section)
            if os.path.isdir(section_path):
                pages.append([f"{base_url}library/{section}", "0.7"])
                for lesson_file in os.listdir(section_path):
                    if lesson_file.endswith(".html"):
                        lesson_name = lesson_file[:-5]
                        pages.append([f"{base_url}library/{section}/{lesson_name}", "0.6"])

    sitemap_xml = render_template("sitemap_template.xml", pages=pages, lastmod=datetime.now().strftime('%Y-%m-%d'))
    response = make_response(sitemap_xml)
    response.headers["Content-Type"] = "application/xml"
    return response




if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=Config.DEBUG)