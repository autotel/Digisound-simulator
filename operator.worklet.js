// @ts-check
//@ts-ignore
const samplingRate = sampleRate || 44100;
const timeIncrementOfSample = 1 / samplingRate;
//@ts-ignore
if (!sampleRate) console.warn("sampleRate is not defined. Using 44100 instead.");

const e = Math.E;
const pi = Math.PI;
const twoPi = pi * 2;

const clip = (val) => {
    if (val > 1) return 1;
    if (val < -1) return -1;
    return val;
}
const applyHardnessCurve = (val) => {
    return e ^ (-val) * (e ^ val) - 1;
}
const applySigmoidRange = (input, alpha = 2.5) => {
    return 2 / (1 + Math.pow(e, -alpha * input)) - 1;
}

const clamp = (v, min, max) => {
    if (v < min) return min
    if (v > max) return max
    return v
}

const square = (t) => {
    return (t % 1) < 0.5 ? 1 : -1;
}

const cosWindow = (t) => {
    if (t < -1) return 0;
    if (t > 1) return 0;
    return Math.cos(t * twoPi) * 0.5 + 0.5;
}

const cosMultiWindow = (t) => {
    return Math.cos(t * twoPi) * 0.5 + 0.5;
}

const sin = (t) => {
    return Math.sin(t * twoPi);
}

class SampleBySampleOperator {
    /**
     * @param {number} inSample
     */
    operation = (inSample) => inSample;
}

class SineOscillator extends SampleBySampleOperator {
    frequency = 0;
    phase = 0;
    phaseIncrement = 1 / samplingRate;
    operation = () => {
        this.phase += this.phaseIncrement * this.frequency;
        return Math.sin(this.phase * twoPi);
    }
}

class Noise extends SampleBySampleOperator {
    operation = () => {
        // TODO: use fast, less precise random
        return Math.random() * 2 - 1
    }
}

class DelayLine extends SampleBySampleOperator {

    delaySamples = 400;
    feedback = 0.99;
    /** @type {Array<Number>}*/
    memory = [];

    /**
     * @param {Number} insample
     * @param {null | function} sidechain
     * */
    operation = (insample, sidechain = null) => {
        let ret = 0;

        if (this.memory.length > this.delaySamples) {
            ret += this.memory.shift() || 0;
        }
        if (this.memory.length > this.delaySamples) {
            this.memory.splice(0, this.memory.length - this.delaySamples);
        }
        ret += insample;

        if (sidechain) {
            ret = sidechain(ret);
        }

        this.memory.push(ret * this.feedback);
        return ret;
    }
    operationNoTime = (insample) => {
        let ret = 0;

        ret += this.memory[0] || 0;
        ret += insample;


        // if (this.sidechainEffect) {
        //     ret = this.sidechainEffect.operation(ret);
        // }

        this.memory[0] += ret * this.feedback;
        return ret;

    }
    reset = () => {
        this.memory = [];
    }
}

class LpBoxcar extends SampleBySampleOperator {
    /** @type {number} */
    k
    /** 
     * @param {number} k
     */
    constructor(k) {
        super();
        this.k = k;
        let mem = 0;
        /** 
         * @param {number} x
         * @returns {number}
         */
        this.operation = (x) => {
            mem = this.k * x + (1 - this.k) * mem;
            return mem;
        }
        this.reset = () => {
            mem = 0;
        }
    }
}

class DCRemover extends SampleBySampleOperator {
    /** @type {Number}*/
    memory = 0;
    operation = (insample) => {
        let ret = 0;
        ret = insample - this.memory;
        this.memory = insample * 0.01 + this.memory * 0.99;
        return ret;
    }
}

class IIRFilter1 extends SampleBySampleOperator {
    /** @type {Array<Number>}*/
    memory = [0, 0, 0];
    amp = 0.99;
    operation = (insample) => {
        let ret = 0;

        ret = insample * 0.01;
        ret += this.memory[0] * 0.2;
        ret += this.memory[1] * 0.3;
        ret += this.memory[2] * 0.49;
        ret *= this.amp;

        this.memory.pop();
        this.memory.unshift(ret);

        return ret;
    }
}

class IIRLPFRochars extends SampleBySampleOperator {
    // based on https://github.com/rochars/low-pass-filter/blob/master/index.js
    /*
    * Copyright (c) 2018-2019 Rafael da Silva Rocha.
    * Copyright (c) 2011 James Robert, http://jiaaro.com
    *
    * Permission is hereby granted, free of charge, to any person obtaining
    * a copy of this software and associated documentation files (the
    * "Software"), to deal in the Software without restriction, including
    * without limitation the rights to use, copy, modify, merge, publish,
    * distribute, sublicense, and/or sell copies of the Software, and to
    * permit persons to whom the Software is furnished to do so, subject to
    * the following conditions:
    *
    * The above copyright notice and this permission notice shall be
    * included in all copies or substantial portions of the Software.
    *
    * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
    * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
    * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
    * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
    * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
    * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
    * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
    */
    /** @type {Number} */
    rc;
    /** @type {Number} */
    dt;
    /** @type {Number} */
    alpha;
    /** @type {Number} */
    last_val = 0;
    /** @type {Number} */
    offset;
    constructor(cutoff) {
        super();
        this.setCutoff(cutoff);
    }
    setCutoff(cutoff) {
        this.rc = 1.0 / (cutoff * 2 * Math.PI);
        this.dt = timeIncrementOfSample;
        this.alpha = this.dt / (this.rc + this.dt);
    }
    operation = (insample) => {
        this.offset++;
        this.last_val = this.last_val
            + (this.alpha * (insample - this.last_val));
        return this.last_val;
    }
}
class IIRBPFRochars extends SampleBySampleOperator {
    /** @type {IIRLPFRochars} */
    lp;
    /** @type {IIRLPFRochars} */
    hp;
    constructor(hpFreq, lpFreq) {
        super();
        this.lp = new IIRLPFRochars(lpFreq);
        this.hp = new IIRLPFRochars(hpFreq);
    }
    setFreqs(hpFreq, lpFreq) {
        this.lp.setCutoff(lpFreq);
        this.hp.setCutoff(hpFreq);
    }
    operation = (inSample) => {
        const hiPassed = inSample - this.hp.operation(inSample);
        return this.lp.operation(hiPassed);
    }
}
/**
 * bfilt - High-order Butterworth filter.
by Andy Allinger, 2021, released to the public domain

   Permission  to  use, copy, modify, and distribute this software and
   its documentation  for  any  purpose  and  without  fee  is  hereby
   granted,  without any conditions or restrictions.  This software is
   provided "as is" without express or implied warranty.

Refer to:

    "Cookbook formulae for audio EQ biquad filter coefficients"
    Robert Bristow-Johnson, [2005]

    "The Butterworth Low-Pass Filter"
    John Stensby, 19 Oct 2005

The Butterworth poles lie on a circle.  The product of the qualities
is 2^(-1/2).
*/
class Butterworth1 extends SampleBySampleOperator {
    /**
     *    @param {number} fpass Pass frequency, cycles per second
     *    @param {number} fstop Stop frequency, cycles per second
     *    @param {number} hpass Minimum passband transmission, fraction 0...1
     *    @param {number} hstop Maximum stopband transmission, fraction 0...1
    */
    constructor(fpass, fstop, hpass, hstop) {
        super();
        let x = 0;
        let x1 = 0;
        let x2 = 0;
        let y = 0;
        let y1 = 0;
        let y2 = 0;
        let a0, a1, a2, b1, b2;
        this.set = (fpass, fstop, hpass, hstop) => {
            if (!fpass || !fstop || !hpass || !hstop) throw new Error('fpass, fstop, hpass and hstop are required. got ' + fpass + ' ' + fstop + ' ' + hpass + ' ' + hstop);
            if (fpass <= 0 || fpass >= 0.5 * samplingRate) throw new Error('fpass must be between 0 and 0.5 * samplingRate, got ' + fpass);
            if (fstop <= 0 || fstop >= 0.5 * samplingRate) throw new Error('fstop must be between 0 and 0.5 * samplingRate, got ' + fstop);
            if (hpass <= 0 || hpass >= 1) throw new Error('hpass must be between 0 and 1, got ' + hpass);
            if (hstop <= 0 || hstop >= 1) throw new Error('hstop must be between 0 and 1, got ' + hstop);
            if (fpass === fstop) throw new Error('fpass and fstop must be different, got ' + fpass);
            const isLowpass = fpass < fstop;
            const d = 1 / hstop;
            const e = Math.sqrt(1 / (hpass * hpass) - 1);
            let n = Math.floor(Math.abs(Math.log(e / Math.sqrt(d * d - 1)) / Math.log(fpass / fstop))) + 1;
            if (n % 2) ++n;
            const o = isLowpass ? -1 / n : 1 / n;
            const fcut = fstop * Math.pow(Math.sqrt(d * d - 1), o);
            const w0 = twoPi * fcut / samplingRate;
            const c = Math.cos(w0);
            for (let k = Math.floor(n / 2); k >= 1; --k) {
                const q = -0.5 / Math.cos(Math.PI * (2 * k + n - 1) / (2 * n));
                const r = Math.sin(w0) / (2 * q);
                if (isLowpass) {
                    a1 = (1 - c) / (1 + r);
                    a0 = 0.5 * a1;
                } else {
                    a1 = -(1 + c) / (1 + r);
                    a0 = -0.5 * a1;
                }
                a2 = a0;
                b1 = -2 * c / (1 + r);
                b2 = (1 - r) / (1 + r);

            }
            return 0;
        }

        this.set(fpass, fstop, hpass, hstop);
        this.ll = 1000;
        this.operation = (input) => {
            x2 = x1;
            x1 = x;
            x = input;
            y2 = y1;
            y1 = y;
            y = a0 * x + a1 * x1 + a2 * x2 - b1 * y1 - b2 * y2;
            return y;
        }
    }
}
class ButterworthLpf1 extends SampleBySampleOperator {
    constructor(cutoffFreq = 500, gain = 1, sharpness = 1.2) {
        super();

        const hpass = 0.95;
        const hstop = 0.05;
        /** @type {Butterworth1} */
        let b;
        this.set = (cutoffFreq = 500, gain = 1, sharpness = 8) => {
            const fpass = cutoffFreq;
            const fstop = cutoffFreq - cutoffFreq / sharpness;
            if (!b) {
                b = new Butterworth1(fpass, fstop, hpass, hstop);
            } else {
                b.set(fpass, fstop, hpass, hstop);
            }
            this.operation = (input) => {
                return b.operation(input * gain);
            }
        }
        this.operation = (input) => 0;
        this.set(cutoffFreq, gain, sharpness);
    }
}
class ButterworthHpf1 extends SampleBySampleOperator {
    constructor(cutoffFreq = 1, gain = 1, sharpness = 1.2) {
        super();

        const hpass = 0.95;
        const hstop = 0.05;
        /** @type {Butterworth1} */
        let b;
        this.set = (cutoffFreq = 500, gain = 1, sharpness = 1.2) => {
            const fpass = cutoffFreq;
            const fstop = cutoffFreq - cutoffFreq / sharpness;
            if (!b) {
                b = new Butterworth1(fpass, fstop, hpass, hstop);
            } else {
                b.set(fpass, fstop, hpass, hstop);
            }
            this.operation = (input) => {
                return b.operation(input * gain);
            }
        }
        this.operation = (input) => 0;
        this.set(cutoffFreq, gain, sharpness);
    }
}

class ButterworthBpf1 extends SampleBySampleOperator {
    constructor(hpFreq = 1, lpFreq = 500) {
        const hp = new ButterworthHpf1(hpFreq);
        const lp = new ButterworthLpf1(lpFreq);
        super();
        this.operation = (input) => {
            return lp.operation(hp.operation(input));
        }
        this.setFreqs = (hpFreq, lpFreq) => {
            hp.set(hpFreq);
            lp.set(lpFreq);
        }
    }
}

class LpMoog extends SampleBySampleOperator {
    constructor(frequency, reso) {
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
            // this.reset();
            if (frequency < 0) frequency = 0;
            f = (frequency / samplingRate) * twoPi // probably bogus, origially was * 1.16 but was not working well

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



class Lerper {
    increments = 0;
    life = 0;
    val = 0;
    set(start, target, life) {
        // edge case

        this.increments = (target - start) / life
        this.val = start;
        this.life = life;
        if (life < 1) this.val = target;
    }
    step() {
        if (this.life < 1) {
            return this.val
        }
        this.life--;
        this.val += this.increments;
        return this.val;
    }
}

class Exciter extends SampleBySampleOperator {
    /** 
     * attack, seconds
     * @type {number} 
     */
    attack = 0.1;

    /** 
     * decay, seconds
     * @type {number} 
     */
    decay = 0;

    /** 
     * duration, seconds
     * @type {number} 
     */
    duration = 0;

    /**
     * @type {{val: number}}
     */
    envelope = new Lerper();

    start({ amp }) { }
}


class Harmonics extends SampleBySampleOperator {
    /** @type {number[]} */
    amps = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
    /** @type {number[]} */
    phase = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    /** @type {number} */
    phaseIncrement = 1 / samplingRate;
    /** @type {number} */
    freq = 440;
    /** @type {number} */
    amp = 0.5;
    /** @type {number} */
    harmonicsCount = 1;
    /** @type {number} */
    harmonicOffset = 0;

    constructor() {
        super();
    }

    operation = () => {
        let sample = 0;
        for (let i = 0; i < this.harmonicsCount; i++) {
            if (!this.phase[i]) this.phase[i] = 0;
            this.phase[i] += this.phaseIncrement * this.freq * (i - this.harmonicOffset);
            const tf = this.phase[i];
            sample += Math.sin(tf * twoPi) * this.amps[i];
            // sample += square(tf);
        }
        return sample * this.amp / this.harmonicsCount;
    }
}
/**
 * @template T
 * @param {number} length
 * @param {(i:number)=>T} cb
 * @returns {T[]}
 */
const createArray = (length, cb) => {
    const ret = [];
    for (let i = 0; i < length; i++) {
        ret.push(cb(i));
    }
    return ret;
}
// @ts-ignore
class MyProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            {
                name: "vol",
                defaultValue: 0.5,
                minValue: 0,
                maxValue: 1
            },
            {
                name: "pw",
                defaultValue: 0.5,
                minValue: 0,
                maxValue: 1
            },
            {
                name: "f_reso",
                defaultValue: 0.5,
                minValue: 0,
                maxValue: 5,
            },
            {
                name: "f_octave",
                defaultValue: 5,
                minValue: 0,
                maxValue: 9
            },
            {
                name: "octave",
                defaultValue: 5,
                minValue: 0,
                maxValue: 9
            },
            {
                name: "hoffset",
                defaultValue: -1,
                minValue: -5,
                maxValue: 5
            },
            {
                name: "hcount",
                defaultValue: 5,
                minValue: 1,
                maxValue: 32,
            },
            {
                name: "spectrum",
                defaultValue: 0.5,
                minValue: 0,
                maxValue: 1
            },
            {
                name: "width",
                defaultValue: 1,
                minValue: 0,
                maxValue: 10
            },


        ];
    }

    filter = new LpMoog(0, 0);
    harmonics = new Harmonics();

    phase = 0;
    phaseIncrement = 1 / samplingRate;
    process(inputs, outputs, parameters) {

        const vol = parameters.vol[0];
        const pw = parameters.pw[0];
        const reso = parameters.f_reso[0];
        const fOctave = parameters.f_octave[0];
        const octave = parameters.octave[0];

        const harmOffset = parameters.hoffset[0];
        const harmCount = parameters.hcount[0];
        const spectrumOctave = parameters.spectrum[0];
        const spectrumWidth = parameters.width[0];

        const fFreq = 11 * Math.pow(2, fOctave);
        const freq = 11 * Math.pow(2, octave);
        const spectrumFreq = 11 * Math.pow(2, spectrumOctave);

        this.harmonics.freq = freq;
        this.harmonics.harmonicsCount = harmCount;
        this.harmonics.harmonicOffset = harmOffset;

        this.harmonics.amps = createArray(this.harmonics.harmonicsCount, (i) => {
            return cosWindow((i * spectrumOctave) / (this.harmonics.harmonicsCount * spectrumWidth));
        });

        this.filter.set(fFreq, reso);

        const output = outputs[0];
        output.forEach((channel) => {
            for (let index = 0; index < channel.length; index++) {
                this.phase += this.phaseIncrement;
                const t = this.phase;
                const tf = t * freq;
                let sample = 0;
                // sample = (tf % 1) < pw ? -vol : vol;
                sample = this.harmonics.operation();
                sample = this.filter.operation(sample);
                channel[index] = sample + Math.random() * 0.01;
            }
        });
        return true;
    }
}

// @ts-ignore
registerProcessor("my-processor", MyProcessor);