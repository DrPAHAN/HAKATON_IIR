// Инициализация
let segmenter;
let video;
let canvas;
let ctx;
let backgroundImage = new Image(); // Персонализированный фон
let lastTime = 0;
let fps = 0;
let showPersonal = true;

// Загрузка модели Selfie Segmentation (MediaPipe runtime для скорости)
async function loadModel() {
    const model = bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation;
    const segmenterConfig = {
        runtime: 'mediapipe', // 'tfjs' для iOS
        solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation',
        modelType: 'landscape' // 'general' для выше точности, но медленнее
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
        segmentationThreshold: 0.7 // Трешхолд для точности (0.5-0.9)
    });
    
    // Создание маски (прозрачный для фона, непрозрачный для человека)
    const foregroundColor = { r: 255, g: 255, b: 255, a: 255 }; // Человек
    const backgroundColor = { r: 0, g: 0, b: 0, a: 0 }; // Фон прозрачный
    const mask = await bodySegmentation.toBinaryMask(
        segmentation,
        foregroundColor,
        backgroundColor,
        false, // Без контура
        0.5 // Трешхолд
    );
    
    // Рисуем фон
    if (backgroundImage.src) {
        ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    } else {
        ctx.fillStyle = '#00ff00'; // Зеленый по умолчанию
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
    
    // Загрузка шаблона (из select)
    const templatePath = document.getElementById('template-select').value;
    const templateImg = new Image();
    templateImg.src = `templates/${templatePath}`; // Путь к шаблонам
    templateImg.onload = () => {
        tempCtx.drawImage(templateImg, 0, 0, tempCanvas.width, tempCanvas.height);
        
        if (showPersonal) {
            const name = document.getElementById('name').value;
            const position = document.getElementById('position').value;
            const department = document.getElementById('department').value;
            
            // Рисуем текст (с контрастом: проверяем яркость фона)
            tempCtx.font = 'bold 20px Arial';
            const textColor = getContrastColor(tempCtx); // Функция ниже
            tempCtx.fillStyle = textColor;
            tempCtx.fillText(`${name}, ${position}, ${department}`, 20, tempCanvas.height - 20);
            
            // Добавь логотип, если есть (аналогично)
        }
        
        backgroundImage.src = tempCanvas.toDataURL(); // Сохраняем как изображение
    };
}

// Функция для контраста (простая: средняя яркость)
function getContrastColor(ctx) {
    const imageData = ctx.getImageData(0, 0, 640, 480).data;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < imageData.length; i += 4) {
        r += imageData[i];
        g += imageData[i + 1];
        b += imageData[i + 2];
    }
    const brightness = (r + g + b) / (imageData.length / 4 * 3);
    return brightness > 128 ? 'black' : 'white'; // Черный на светлом, белый на темном
}

// События
document.getElementById('start-cam').addEventListener('click', startCamera);
document.getElementById('generate-bg').addEventListener('click', generateBackground);
document.getElementById('show-personal').addEventListener('change', (e) => {
    showPersonal = e.target.checked;
    generateBackground();
});

// Загрузка данных из JSON (пример)
fetch('employee.json')
    .then(response => response.json())
    .then(data => {
        document.getElementById('name').value = data.name;
        document.getElementById('position').value = data.position;
        // Добавь отдел, если есть
    });