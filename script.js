// Инициализация
let segmenter;
let video;
let canvas;
let ctx;
let backgroundImage = new Image(); // Персонализированный фон
let lastTime = 0;
let fps = 0;
let showPersonal = true;
let employeeData = { name: "Иван Иванов", position: "Разработчик", department: "IT" }; // Данные по умолчанию

// Загрузка модели Selfie Segmentation (MediaPipe runtime для скорости)
async function loadModel() {
    const model = bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation;
    const segmenterConfig = {
        runtime: 'mediapipe',
        solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation',
        modelType: 'landscape'
    };
    segmenter = await bodySegmentation.createSegmenter(model, segmenterConfig);
    console.log('Модель загружена');
}

// Захват камеры
async function startCamera() {
    video = document.getElementById('video');
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.play();
    
    await loadModel();
    requestAnimationFrame(processFrame);
}

// Обработка кадра (сегментация + замена фона)
async function processFrame(timestamp) {
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        requestAnimationFrame(processFrame);
        return;
    }
    
    // Расчет FPS
    if (lastTime !== 0) {
        fps = 1000 / (timestamp - lastTime);
        document.getElementById('fps').textContent = `FPS: ${Math.round(fps)}`;
    }
    lastTime = timestamp;
    
    // Сегментация
    const segmentation = await segmenter.segmentPeople(video, {
        flipHorizontal: false,
        multiSegmentation: false,
        segmentBodyParts: false,
        segmentationThreshold: 0.7
    });
    
    // Создание маски
    const foregroundColor = { r: 255, g: 255, b: 255, a: 255 };
    const backgroundColor = { r: 0, g: 0, b: 0, a: 0 };
    const mask = await bodySegmentation.toBinaryMask(
        segmentation,
        foregroundColor,
        backgroundColor,
        false,
        0.5
    );
    
    // Рисуем фон
    if (backgroundImage.src) {
        ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    } else {
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Накладываем человека с маской
    await bodySegmentation.drawMask(canvas, video, mask, 1.0, 0);
    
    requestAnimationFrame(processFrame);
}

// Генерация персонализированного фона
function generateBackground() {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 640;
    tempCanvas.height = 480;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Загрузка шаблона
    const templatePath = document.getElementById('template-select').value;
    const templateImg = new Image();
    templateImg.src = `templates/${templatePath}`;
    templateImg.onload = () => {
        tempCtx.drawImage(templateImg, 0, 0, tempCanvas.width, tempCanvas.height);
        
        if (showPersonal) {
            // Используем данные из JSON или полей ввода
            const name = document.getElementById('name').value || employeeData.name;
            const position = document.getElementById('position').value || employeeData.position;
            const department = document.getElementById('department').value || employeeData.department;
            
            // Рисуем текст с контрастом
            tempCtx.font = 'bold 20px Arial';
            const textColor = getContrastColor(tempCtx);
            tempCtx.fillStyle = textColor;
            tempCtx.fillText(`${name}, ${position}, ${department}`, 20, tempCanvas.height - 20);
        }
        
        backgroundImage.src = tempCanvas.toDataURL();
    };
}

// Функция для контраста
function getContrastColor(ctx) {
    const imageData = ctx.getImageData(0, 0, 640, 480).data;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < imageData.length; i += 4) {
        r += imageData[i];
        g += imageData[i + 1];
        b += imageData[i + 2];
    }
    const brightness = (r + g + b) / (imageData.length / 4 * 3);
    return brightness > 128 ? 'black' : 'white';
}

// События
document.getElementById('start-cam').addEventListener('click', startCamera);
document.getElementById('generate-bg').addEventListener('click', generateBackground);
document.getElementById('show-personal').addEventListener('change', (e) => {
    showPersonal = e.target.checked;
    generateBackground();
});

// Загрузка данных из JSON и обновление полей
fetch('employee.json')
    .then(response => response.json())
    .then(data => {
        employeeData = data; // Сохраняем данные
        document.getElementById('name').value = data.name || employeeData.name;
        document.getElementById('position').value = data.position || employeeData.position;
        document.getElementById('department').value = data.department || employeeData.department;
        generateBackground(); // Генерируем фон с данными из JSON
    })
    .catch(error => {
        console.error('Ошибка загрузки JSON:', error);
        generateBackground(); // Используем данные по умолчанию
    });