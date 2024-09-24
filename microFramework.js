'use-strict';
// @ts-check
/**
 * @typedef {Object} NumParam
 * @property {string} name
 * @property {number} value
 * @property {number} min
 * @property {number} max
 */

/**
 * @template {Object} T
 * @typedef {Object} $El<T>
 * @property {HTMLElement} body
 * @property {()=>void} redraw
 * @property {T} data
 */


/**
 * @typedef {Object} KnobData
 * @property {NumParam} param
 */

/**
 * @typedef {$El<KnobData>} $Knob
 */

/**
 * @returns {$Knob}
 * @param {NumParam} param
 */
const mkKnob = (param) => {
    const body = document.createElement('div');
    const round = document.createElement('canvas');
    const readout = document.createElement('div');
    body.style.cursor = 'pointer';
    round.innerHTML = '🪳';
    body.style.userSelect = 'none';

    body.appendChild(round);
    body.appendChild(readout);

    const paramRange = param.max - param.min;

    let isDragging = false;
    let dragValueStarted = 0;

    const redraw = () => {
        readout.innerHTML = data.param.value.toFixed(2) + ' ' + data.param.name;
        round.width = 20;
        round.height = 20;
        const ctx = round.getContext('2d');
        if (!ctx) {
            throw new Error('no 2d context');
        }
        ctx.clearRect(0, 0, round.width, round.height);
        ctx.strokeStyle = 'white';
        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.arc(round.width / 2, round.height / 2, round.width / 2, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.fill();
        ctx.beginPath();
        ctx.lineWidth = 2;
        const angle = (data.param.value - data.param.min) / paramRange * 2 * Math.PI;
        ctx.moveTo(round.width / 2, round.height / 2);
        ctx.lineTo(round.width / 2 + Math.cos(angle) * round.width / 2, round.height / 2 + Math.sin(angle) * round.height / 2);
        ctx.stroke();
    }
    round.addEventListener('mousedown', () => {
        isDragging = true;
        dragValueStarted = data.param.value;
        round.setPointerCapture(1);
    });

    round.addEventListener('pointermove', (e) => {
        if (isDragging) {
            e.preventDefault();
            e.stopImmediatePropagation();
            const rect = round.getBoundingClientRect();
            const centerY = rect.top + rect.height / 2;
            const dy = e.clientY - centerY;
            let newVal = dragValueStarted - paramRange * dy / 1000;
            if (newVal < param.min) {
                newVal = param.min;
            }
            if (newVal > param.max) {
                newVal = param.max;
            }
            data.param.value = newVal;
            redraw();
        }
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        round.releasePointerCapture(1);
    });

    const data = {
        param
    };

    return {
        body,
        redraw,
        data,
    };
}

/**
 * @typedef {Object} ArrayScopeData
 * @property {number[]} values
 */

/**
 * @typedef {$El<ArrayScopeData>} $ArrayScope
 */
/**
 * @param {{values:number[]}} data
 * @returns {$ArrayScope}
 */
const mkArrayScope = (data) => {
    const body = document.createElement('canvas');
    body.width = 1000;
    body.height = 300;
    body.style.backgroundColor = 'black';
    const ctx = body.getContext('2d');
    if (!ctx) {
        throw new Error('no 2d context');
    }
    const redraw = () => {
        ctx.clearRect(0, 0, body.width, body.height);
        ctx.strokeStyle = 'white';
        ctx.beginPath();
        const halfHeight = body.height / 2;
        ctx.moveTo(0, halfHeight);
        let lastv = 1;
        const firstPositiveZeroCrossing = data.values.findIndex(v => {
            const ret = lastv < 0 && v >= 0;
            lastv = v;
            return ret;
        });
        for (let i = 0; i < body.width; i++) {
            const index = Math.floor(data.values.length * i / body.width) + firstPositiveZeroCrossing;
            if(index >= data.values.length){
                break;
            }
            ctx.lineTo(i, halfHeight - data.values[index] * halfHeight);
        }
        ctx.stroke();
    }
    return {
        body,
        redraw,
        data,
    };
}

/**
 * @template {Obect} T
 * @param {T} watcheable
 * @param {(unknown, T, unknown, unknown)=>void} callback
 * @returns {T}
 */
const watch = (watcheable, callback) => {
    const handler = {
        set(target, prop, value) {
            target[prop] = value;
            callback(target, prop, value, target[prop]);
            return true;
        }
    };
    return new Proxy(watcheable, handler);
}


