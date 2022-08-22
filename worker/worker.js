importScripts('../wasm/ai.js')
importScripts('../wasm/ainr.js')
var isDeNoise = false;
var collection = false;
var abortController;
var nrEngine;
var engineModule = null;
let originBuffer;
let changeBuffer;
let origin = [];
let change = [];
var init = false;
initWasm(48000);
// setTimeout(() => {
//     initWasm(48000);
// }, 1000)

self.onmessage = async ({ data: { source, sink, open_ainr, startCollect, openAudioDownload } }) => {
    if (source && sink) {
        transformer = new TransformStream({ transform: handleData(openAudioDownload) });
        abortController = new AbortController();
        const signal = abortController.signal;
        const promise = source.pipeThrough(transformer, { signal }).pipeTo(sink);
        promise.catch((e) => {
            if (signal.aborted) {
                console.log('Shutting down streams after abort.');
            } else {
                console.error('Error from stream transform:', e);
            }
            source.cancel(e);
            sink.abort(e);
        });
    }
    if (open_ainr && open_ainr.type === 'ainr_switch') {
        isDeNoise = open_ainr.value;
    }
    if (startCollect) {
        collection = startCollect;
    }
};

function handleData(openAudioDownload) {
    originBuffer = new Float32Array(480);
    changeBuffer = new Float32Array(480);
    return (data, controller) => {
        // 音频格式
        const format = data.format;
        // 复制原始音频数据
        if (openAudioDownload) {
            originBuffer = new Float32Array(480);
        }
        data.copyTo(originBuffer, { planeIndex: 0, format });
        // 降噪后音频数据
        const input = nrEngine.getInputDataBuffer();
        input.set(originBuffer);
        let value;
        if (format === 'f32-planar') {
            value = 0;
        } else if (format === 's32-planar') {
            value = 1;
        } else if (format === 's16-planar') {
            value = 2;
        } else if (format === 'u8-planar') {
            value = 3;
        }
        changeBuffer = openAudioDownload ? new Float32Array(nrEngine.processFrame(value)) : nrEngine.processFrame(value);
        // 存储每一帧的原始音频及降噪后音频数据
        saveBuffer(originBuffer, changeBuffer);
        if (collection) {
            // 输出所存储的原始数据及降噪后的数据交给主线程
            let origin_buffer = new Float32Array(origin.length * data.numberOfFrames);
            origin.map((item, index) => {
                origin_buffer.set(item, [data.numberOfFrames * index])
            })
            let change_buffer = new Float32Array(change.length * data.numberOfFrames);
            change.map((item, index) => {
                change_buffer.set(item, [data.numberOfFrames * index])
            })
            self.postMessage({ origin_buffer, change_buffer });
            abortController.abort();
            abortController = null;
        }
        // 输出
        controller.enqueue(new AudioData({
            format: data.format,
            sampleRate: data.sampleRate,
            numberOfFrames: data.numberOfFrames,
            numberOfChannels: data.numberOfChannels,
            timestamp: data.timestamp,
            data: isDeNoise ? changeBuffer : originBuffer
        }));
    };
}

function saveBuffer(originBuffer, changeBuffer) {
    origin.push(originBuffer);
    change.push(changeBuffer);
}

// 初始化wasm
async function initWasm(data) {
    const model_name = '../model/howlnr.model';
    let cpu_model_file = await fetch(model_name).then(response => {
        if (!response.ok) {
            return null;
        }
        return response.blob();
    });
    nrEngine = await new Module.AudioNrEngine(data, 1024, 1024, 4);
    let cpu_model = new Uint8Array(await cpu_model_file.arrayBuffer());
    console.log('initAudioNr status: ' + nrEngine.initAudioNr(cpu_model));
    init = true;
}
