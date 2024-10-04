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
        ctx.beginPath();
        ctx.strokeStyle = 'black';
        ctx.moveTo(10, 10);
        ctx.lineTo(
            10 + 8 * Math.cos(data.param.value * 2 * Math.PI / paramRange),
            10 + 8 * Math.sin(data.param.value * 2 * Math.PI / paramRange)
        );
        ctx.stroke();
        ctx.closePath();
        ctx.ellipse(10, 10, 10, 10, 0, 0, 2 * Math.PI);
        ctx.stroke();

    }
    round.addEventListener('mousedown', () => {
        isDragging = true;
        dragValueStarted = data.param.value;
        // round.setPointerCapture(1);
        round.requestPointerLock();
    });
    

    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            e.preventDefault();
            e.stopImmediatePropagation();
            const rect = round.getBoundingClientRect();
            const dy = e.movementY;
            let newVal = param.value - paramRange * dy / 1000;
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
        document.exitPointerLock();
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
    const body = document.createElement('div');
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 300;
    canvas.style.backgroundColor = 'black';
    const vZoom = mkKnob({
        name: 'vZoom',
        value: 1,
        min: 0.1,
        max: 100,
    });
    body.appendChild(vZoom.body);
    body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('no 2d context');
    }
    const redraw = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = 'white';
        ctx.beginPath();
        const halfHeight = canvas.height / 2;
        ctx.moveTo(0, halfHeight);
        let lastv = 1;
        const firstPositiveZeroCrossing = data.values.findIndex(v => {
            const ret = lastv < 0 && v >= 0;
            lastv = v;
            return ret;
        });
        for (let i = 0; i < canvas.width; i++) {
            const index = Math.floor(data.values.length * i / canvas.width) + firstPositiveZeroCrossing;
            if(index >= data.values.length){
                break;
            }
            const val = data.values[index];
            const zoomedVal = val * vZoom.data.param.value;
            ctx.lineTo(i, halfHeight - zoomedVal * halfHeight);
        }
        ctx.stroke();
    }
    return {
        vZoom,
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


