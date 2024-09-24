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
    body.style.width = '20px';
    body.style.height = '20px';
    body.style.backgroundColor = 'red';
    body.style.borderRadius = '50%';
    body.style.cursor = 'pointer';

    const paramRange = param.max - param.min;

    let isDragging = false;

    const redraw = () => {
        body.innerHTML = data.param.value.toFixed(2);
        body.style.transform = `rotate(${(data.param.value / paramRange) * 360}deg)`;
    }

    body.addEventListener('mousedown', () => {
        isDragging = true;
    });

    window.addEventListener('mousemove', (e) => {
        if (isDragging) {
            e.preventDefault();
            e.stopImmediatePropagation();
            const rect = body.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const dy = e.clientY - centerY;
            let newVal = paramRange * dy / 100;
            if(newVal < param.min) {
                newVal = param.min;
            }
            if(newVal > param.max) {
                newVal = param.max;
            }
            data.param.value = newVal;
            redraw();
        }
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
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
        const xStep = body.width / data.values.length;
        for (let i = 0; i < data.values.length; i++) {
            ctx.lineTo(i * xStep, halfHeight - data.values[i] * halfHeight);
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


