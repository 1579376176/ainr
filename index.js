import Worker from "worker-loader!./Worker.js";
import Worker from "./file.worker.js";

class Ainr {
    constructor() {
        let worker;
        this.initWorker();
        const bundle = {
            processor: '',
            generator: '',
            source: '',
            sink: '',
            open_ainr: true
        }
    };

    initWorker() {
        this.worker = new Worker('./worker/worker.js');
        console.log('worker初始化成功');
        // return worker;
    };

    createAinr(audioTrack) {
        this.bundle.processor = new MediaStreamTrackProcessor(audioTrack);
        this.bundle.generator = new MediaStreamTrackGenerator('audio');
        this.bundle.source  = this.bundle.processor.readable;
        this.bundle.sink = this.bundle.generator.writable;
        // this.bundle.open_ainr = open_ainr;
        const { source, sink, open_ainr} = bundle;
        this.worker.postMessage({ source, sink, open_ainr }, [source, sink]);
    }

    changeAinrState(state) {
        console.log('当前降噪状态' + state ? ' 已开启' : ' 未开启');
        this.worker.postMessage({ 'open_ainr': state });
    }

    downloadAudio() {
        console.log('音频下载成功');
    };
}
let constrains = {
    openAinr: true,
    opendownload: true
}
export default Ainr;
// let ainr = new Ainr();            //这里应该创建worker线程 在worker线程中加载ainr.js
// ainr.createAinr('track', true);     //输出（ 在worker中初始化wasm，frameAudio（）进行处理 ）  传入音频流 且 默认开启降噪
// ainr.changeAinrState(false);                //降噪开关 false：关闭降噪功能               true：开启降噪功能