const digits = [
    document.getElementById('h1'),
    document.getElementById('h2'),
    document.getElementById('m1'),
    document.getElementById('m2'),
    document.getElementById('s1'),
    document.getElementById('s2')
];

let prevVals = null;

function buildBar(digitEl, value) {
    digitEl.innerHTML = '';
    for (let i = value; i >= 0; i--) {
        const num = document.createElement('div');
        num.classList.add('number');
        num.textContent = i;
        digitEl.appendChild(num);
    }
}

function updateClock() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0').split('').map(Number);
    const minutes = now.getMinutes().toString().padStart(2, '0').split('').map(Number);
    const seconds = now.getSeconds().toString().padStart(2, '0').split('').map(Number);
    
    const currentVals = [...hours, ...minutes, ...seconds];

    if (prevVals) {
        currentVals.forEach((val, i) => {
            const prev = prevVals[i];
            // Detecta rollover: quando diminui (ex: 9→0, 59→00 nos minutos, etc.)
            if (val < prev || (val === 0 && prev === 9)) {
                digits[i].classList.add('falling');
                setTimeout(() => {
                    digits[i].classList.remove('falling');
                    buildBar(digits[i], val);
                }, 1200); // Tempo da animação
            } else {
                buildBar(digits[i], val);
            }
        });
    } else {
        currentVals.forEach((val, i) => buildBar(digits[i], val));
    }

    prevVals = currentVals;
}

// Atualiza a cada segundo
setInterval(updateClock, 1000);
updateClock();