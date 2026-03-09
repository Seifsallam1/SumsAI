document.addEventListener('DOMContentLoaded', () => {
  const generateBtn = document.getElementById('generateBtn');
  const openTabBtn = document.getElementById('openTabBtn');
  const lessonInput = document.getElementById('lessonInput');
  const resultFrame = document.getElementById('resultFrame');
  const inputSwitcher = document.querySelector('.input-switcher');
  const textContainer = document.getElementById('text-input-container');
  const fileContainer = document.getElementById('file-input-container');
  const fileUpload = document.getElementById('fileUpload');
  const fileUploadLabel = document.querySelector('.file-upload-label');
  const fileNameDisplay = document.getElementById('file-name-display');

  // عناصر شريط التقدم والرسائل
  const loadingContainer = document.getElementById('loadingContainer');
  const messageElement = document.getElementById('loadingMessage');

  // كود معرض الصور (بدون تغيير)
  const studioScroller = document.querySelector('.studio-container');
  const dots = document.querySelectorAll('.dot');

  if (studioScroller) {
    studioScroller.addEventListener('scroll', () => {
      const scrollLeft = studioScroller.scrollLeft;
      const itemWidth = studioScroller.querySelector('.studio-item').clientWidth + 20;
      const activeIndex = Math.round(scrollLeft / itemWidth);

      dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === activeIndex);
      });
    });
  }

  // الحدود (بدون تغيير)
  const MAX_IMAGES = 10;

  let currentInputType = 'text';

  // --- Event Listeners (تبديل واجهة الإدخال) ---
  inputSwitcher.addEventListener('change', (e) => {
    currentInputType = e.target.value;
    updateInputUI(currentInputType);
  });

  fileUpload.addEventListener('change', () => {
    const files = fileUpload.files;
    if (files.length > 0) {
      if (currentInputType === 'image' && files.length > MAX_IMAGES) {
        fileNameDisplay.textContent = `Error: You can only select up to ${MAX_IMAGES} images.`;
        fileNameDisplay.style.color = 'red';
        fileUpload.value = '';
        return;
      }

      if (files.length === 1) {
        fileNameDisplay.textContent = `Selected file: ${files[0].name}`;
      } else {
        fileNameDisplay.textContent = `${files.length} files selected`;
      }
      fileNameDisplay.style.color = '#2ecc71';
    } else {
      fileNameDisplay.textContent = '';
    }
  });

  // -------------------- حدث تقديم النموذج (Streaming مع شريط التقدم) --------------------
  document.getElementById('summaryForm').addEventListener('submit',
    async (e) => {
      e.preventDefault();

      // عناصر الزر
      const btnText = generateBtn.querySelector('.btn-text');
      const loader = generateBtn.querySelector('.loader');

      const formData = new FormData();
      formData.append('input_type', currentInputType);

      // التحقق من صحة الإدخال
      if (currentInputType === 'text') {
        const text = lessonInput.value.trim();
        if (!text) {
          alert("Please enter some text to summarize.");
          return;
        }
        formData.append('lesson_text', text);
      } else {
        const files = fileUpload.files;
        if (files.length === 0) {
          alert("Please upload a file.");
          return;
        }
        for (let i = 0; i < files.length; i++) {
          formData.append('file', files[i]);
        }
      }

      // --- بداية التحميل: تعطيل الزر وإظهار شريط التقدم ---
      generateBtn.disabled = true;
      loader.style.display = 'block';
      btnText.textContent = 'Generating...';

      // إخفاء iframe وإظهار شريط التقدم
      loadingContainer.style.display = 'block';
      resultFrame.style.display = 'none';

      // ---------- المرحلة الأولى: شريط "Uploading lesson..." بشكل غير منتظم لمدة 10 ثوانٍ ----------
      messageElement.textContent = '📤 Uploading lesson...';
      let progressBar = document.querySelector('.progress-bar');
      if (progressBar) {
        progressBar.style.animation = 'none';
        progressBar.style.transition = 'none';
        progressBar.style.width = '0%';

        // حركة غير منتظمة على 3 مراحل
        setTimeout(() => {
          progressBar.style.transition = 'width 2s ease-out';
          progressBar.style.width = '45%'; // يقفز إلى 45% في أول ثانيتين
        }, 100);

        setTimeout(() => {
          progressBar.style.transition = 'width 3s ease-in';
          progressBar.style.width = '70%'; // يتحرك ببطء إلى 70% خلال 3 ثوانٍ
        }, 2100); // بعد أول حركة

        setTimeout(() => {
          progressBar.style.transition = 'width 4.9s cubic-bezier(0.1, 0.8, 0.3, 1)';
          progressBar.style.width = '100%'; // يكمل ببطء إلى 100% خلال 5 ثوانٍ تقريباً
        }, 5100); // بعد الحركة الثانية
      }

      // ---------- المرحلة الثانية: رسائل متغيرة مرة واحدة (كل 5 ثوانٍ) ----------
      const messages = [
        "Analyzing lesson...",
        "Reading content...",
        "AI is thinking...",
        "Summarizing and organizing the content...",
        "Creating visual layout...",
        "⚡ Almost here..." // الأخيرة تبقى ثابتة
      ];

      let messageIndex = 0;
      let messageInterval;

      // بعد 10 ثوانٍ (انتهاء الرفع) نبدأ الرسائل
      const uploadTimer = setTimeout(() => {
        // إعادة تعيين شريط التقدم إلى وضع الأنيميشن اللامتناهي
        if (progressBar) {
          progressBar.style.transition = 'none';
          progressBar.style.width = '30%';
          progressBar.style.animation = 'loading 1.5s infinite ease-in-out';
        }

        // عرض أول رسالة
        messageElement.textContent = messages[0];

        // تغيير الرسالة كل 5 ثوانٍ حتى نصل للرسالة الأخيرة
        messageInterval = setInterval(() => {
          messageIndex++;
          if (messageIndex < messages.length - 1) {
            messageElement.textContent = messages[messageIndex];
          } else if (messageIndex === messages.length - 1) {
            // نعرض "Almost here..." ونوقف التغيير
            messageElement.textContent = messages[messageIndex];
            clearInterval(messageInterval);
          }
        },
          5000); // 5 ثوانٍ لكل رسالة
      }, 10000); // 10 ثوانٍ للمرحلة الأولى

      // ---------- الطلب الفعلي إلى الخادم (يتم بالتوازي مع التوقيتات) ----------
      try {
        const response = await fetch('/', {
          method: 'POST', body: formData
        });
        const summaryHTML = await response.text();

        // بغض النظر عن الوقت المستغرق، ننهي كل المؤقتات ونعرض النتيجة
        clearTimeout(uploadTimer);
        clearInterval(messageInterval);

        loadingContainer.style.display = 'none';
        resultFrame.style.display = 'block';
        resultFrame.srcdoc = summaryHTML;

        if (response.ok) {
          openTabBtn.style.display = 'inline-block';
        } else {
          console.error("Server Error:", summaryHTML);
        }
      } catch (error) {
        clearTimeout(uploadTimer);
        clearInterval(messageInterval);
        loadingContainer.style.display = 'none';
        resultFrame.style.display = 'block';
        const errorMessage = `Failed to connect to the server: ${error.message}`;
        resultFrame.srcdoc = `<p style="color: red; text-align: center; font-family: sans-serif; margin-top: 20px;">${errorMessage}</p>`;
        console.error(errorMessage);
      } finally {
        // إعادة الزر إلى حالته الطبيعية
        generateBtn.disabled = false;
        loader.style.display = 'none';
        btnText.textContent = 'Generate with AI';
      }
    });

  // -------------------- دالة تحديث واجهة الإدخال --------------------
  function updateInputUI(type) {
    if (type === 'text') {
      textContainer.style.display = 'block';
      fileContainer.style.display = 'none';
      fileUpload.value = '';
      fileNameDisplay.textContent = '';
    } else {
      textContainer.style.display = 'none';
      fileContainer.style.display = 'block';

      if (type === 'pdf') {
        fileUpload.accept = '.pdf';
        fileUploadLabel.querySelector('span').textContent = 'Click to upload PDF';
        fileUploadLabel.querySelector('span:nth-child(3)').textContent = '(Max 20 pages per request)';
      } else {
        fileUpload.accept = 'image/*';
        fileUploadLabel.querySelector('span').textContent = 'Click to upload Images';
        fileUploadLabel.querySelector('span:nth-child(3)').textContent = '(Max 10 images per request)';
      }
    }
  }

  // -------------------- دالة فتح التلخيص في تبويب جديد (مُحسّنة) --------------------
  window.openInNewTab = function() {
    if (resultFrame.srcdoc && !resultFrame.srcdoc.includes("Error") && !resultFrame.srcdoc.includes("Please wait")) {
      // فتح نافذة جديدة بحجم مناسب
      const newWindow = window.open('', '_blank', 'width=1000,height=700,scrollbars=yes,resizable=yes');
      if (newWindow) {
        newWindow.document.write(resultFrame.srcdoc);
        newWindow.document.close();
        // التركيز على النافذة الجديدة
        newWindow.focus();
      } else {
        alert("Pop-up blocker may be preventing the new window from opening. Please allow pop-ups for this site.");
      }
    } else {
      alert("No valid summary generated yet.");
    }
  };
});