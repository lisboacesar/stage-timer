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
    digitEl.innerHTML = ''; // Sempre limpa antes de reconstruir
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
            // Detecta rollover (diminuição ou reset de 9 para 0)
            if (val < prev || (val === 0 && prev > val)) {
                digits[i].classList.add('falling');
                // Reconstrói após a animação terminar (1.2s + buffer)
                setTimeout(() => {
                    digits[i].classList.remove('falling');
                    buildBar(digits[i], val);
                }, 1300); // 1300ms = 1.2s da animação + 100ms buffer
            } else {
                buildBar(digits[i], val); // Atualiza normalmente sem animação
            }
        });
    } else {
        // Primeira vez: constrói sem animação
        currentVals.forEach((val, i) => buildBar(digits[i], val));
    }

    prevVals = currentVals;
}

setInterval(updateClock, 1000);
updateClock();