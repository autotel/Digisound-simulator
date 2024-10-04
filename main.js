/// <reference path="./microFramework.js" />
// @ts-check
'use-strict';

window.addEventListener('load', function () {


    const audioChangedListener = (audio) => {
        // console.log("audio changed", audio);
    }


    const audio = watch({ values: Array(1000) }, audioChangedListener);
    audio.values.fill(0, 0, 1000);

    const waveScope = mkArrayScope(audio);

    document.body.appendChild(waveScope.body);

    waveScope.redraw();

    const listenButton = document.createElement('div');
    listenButton.classList.add('button');
    listenButton.innerText = 'Listen';
    document.body.appendChild(listenButton);

    let keepGoing = false;
    /** @type {AudioContext | false} */
    let audioContext = false;
    /** @type {AudioWorkletNode | false} */
    let audioWorkletNode = false;
    /** @type {AnalyserNode | false} */
    let analyserNode = false;

    const analyzerFrame = (t) => {
        if (keepGoing) {
            requestAnimationFrame(analyzerFrame);
        }
        if (analyserNode) {
            const bufferLength = analyserNode.frequencyBinCount;
            const dataArray = new Float32Array(bufferLength);
            analyserNode.getFloatTimeDomainData(dataArray);
            const values = Array.from(dataArray);
            audio.values = values;
            waveScope.redraw();
        }
    }

    const knobChangedListener = () => {
        waveScope.redraw();
    }

    listenButton.addEventListener('mousedown', async () => {
        keepGoing = !keepGoing

        if (!audioContext) {
            audioContext = new AudioContext();
        }
        await audioContext.audioWorklet.addModule("operator.worklet.js");
        if (!audioWorkletNode) {
            audioWorkletNode = new AudioWorkletNode(
                audioContext,
                "square-wave-synth",
            );

            const workletParams = audioWorkletNode.parameters;
            const params = [];
            for (let [key, value] of workletParams.entries()) {
                const newP = watch({
                    name: key,
                    value: value.value,
                    max: value.maxValue,
                    min: value.minValue,
                }, () => {
                    value.value = newP.value;
                    knobChangedListener();
                });
                params.push(newP);
            }
            const knobs = params.map(param => mkKnob(param));


            document.body.append(...knobs.map(knob => knob.body));

            knobs.forEach(knob => knob.redraw());
            knobChangedListener();
        }
        if (!analyserNode) {
            analyserNode = audioContext.createAnalyser();
            analyserNode.fftSize = 1024;
            audioWorkletNode.connect(analyserNode);
        }
        if (keepGoing) {
            audioWorkletNode.connect(audioContext.destination);
            requestAnimationFrame(analyzerFrame);
        } else {
            audioWorkletNode.disconnect(audioContext.destination);
        }

    });

});
