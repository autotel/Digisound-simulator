/// <reference path="./microFramework.js" />
// @ts-check
'use-strict';

class SampleBySampleOperator {
    /**
     * @param {number} inSample
     */
    operation = (inSample) => inSample;
}


const clip = (val) => {
    if (val > 1) return 1;
    if (val < -1) return -1;
    return val;
}

class LpMoog extends SampleBySampleOperator {
    constructor(frequency, reso, samplingRate) {
        super();
        let msgcount = 0;
        let in1, in2, in3, in4, out1, out2, out3, out4
        in1 = in2 = in3 = in4 = out1 = out2 = out3 = out4 = 0.0;

        this.reset = () => {
            in1 = in2 = in3 = in4 = out1 = out2 = out3 = out4 = 0.0;
            msgcount = 0;
        }
        let f, af, sqf, fb;
        this.set = (frequency, reso) => {
            this.reset();
            if (frequency < 0) frequency = 0;
            f = (frequency / samplingRate) * Math.PI * 2 // probably bogus, origially was * 1.16 but was not working well

            af = 1 - f;
            sqf = f * f;

            fb = reso * (1.0 - 0.15 * sqf);
        }

        this.operation = (sample, saturate = false) => {

            let outSample = 0;
            sample -= out4 * fb;
            sample *= 0.35013 * (sqf) * (sqf);

            out1 = sample + 0.3 * in1 + af * out1; // Pole 1
            in1 = sample;
            out2 = out1 + 0.3 * in2 + af * out2; // Pole 2
            in2 = out1;
            out3 = out2 + 0.3 * in3 + af * out3; // Pole 3
            in3 = out2;
            out4 = out3 + 0.3 * in4 + af * out4; // Pole 4
            in4 = out3;

            outSample = out4;

            return saturate ? clip(outSample) : outSample;
        }
        this.set(frequency, reso);
    }
}


window.addEventListener('load', function () {
    /**
     * @template {{filter: false | LpMoog}} SCOPE
     * @param {number} sampleRate
     * @param {number[]} array
     * @param {SCOPE} scope
     * @returns {{scope: SCOPE, audio:number[]}}
     */
    const calculate = (sampleRate, array, scope) => {
        const vol = param_VOL.value;
        const pw = param_PW.value;
        const reso = param_RESO.value;
        const octave = param_OCTAVE.value;
        const freq = 11 * Math.pow(2, octave);
        let filter
        if (!scope.filter) {
            filter = scope.filter = new LpMoog(freq, reso, sampleRate);
        }
        return {
            scope,
            audio: array.map((_n, index) => {
                const t = index / sampleRate;
                let sample = (t % 1) < pw ? -vol : vol;
                sample = filter.operation(sample);
                return sample;
            }),
        };
    };

    const knobChangedListener = () => {
        const graphSampleRate = 441
        /** @type {{filter: false | LpMoog}} */
        const scope = { filter: false };
        const calc = calculate(graphSampleRate, audio.values, scope);
        audio.values = calc.audio;

        waveScope.redraw();
    }

    const audioChangedListener = (audio) => {
        // console.log("audio changed", audio);
    }

    const param_PW = watch({
        value: 0.5,
        min: 0,
        max: 1,
        name: 'PW',
    }, knobChangedListener);
    const param_VOL = watch({
        value: 0.5,
        min: 0,
        max: 1,
        name: 'VOL',
    }, knobChangedListener);
    const param_RESO = watch({
        value: 0,
        min: -1,
        max: 1,
        name: 'RESO',
    }, knobChangedListener);
    const param_OCTAVE = watch({
        value: 1,
        min: -5,
        max: 3,
        name: 'FREQ',
    }, knobChangedListener);

    const params = [param_PW, param_VOL, param_RESO, param_OCTAVE];
    const knobs = params.map(param => mkKnob(param));

    const audio = watch({ values: Array(1000) }, audioChangedListener);
    audio.values.fill(0, 0, 1000);

    const waveScope = mkArrayScope(audio);

    document.body.appendChild(waveScope.body);
    document.body.append(...knobs.map(knob => knob.body));

    waveScope.redraw();
    knobs.forEach(knob => knob.redraw());

    knobChangedListener();

});
