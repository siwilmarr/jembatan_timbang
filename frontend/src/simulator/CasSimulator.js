import { TruckScenario } from "./TruckScenario";
import { buildCasFrame } from "./CasFrameBuilder";

/**
 * CAS CI-2001A Emulator
 *
 * Menjalankan skenario kendaraan dan menghasilkan frame
 * seperti indikator CAS asli.
 */
export default class CasSimulator {

    constructor(onFrame){

        this.onFrame = onFrame;

        this.timer = null;

        this.running = false;

    }

    start(name = "engkel"){

        if(this.running) return;

        this.running = true;

        const scenario = TruckScenario[name];

        if(!scenario){

            throw new Error("Scenario tidak ditemukan");

        }

        let index = 0;

        this.timer = setInterval(()=>{

            const weight = scenario[index];

            const stable =
                index >= scenario.length - 3;

            const frame = buildCasFrame({

                weight,

                stable,

                mode:"GS"

            });

            if (this.onFrame) {
                this.onFrame(frame);
            }

            index++;

            if(index >= scenario.length){

                this.stop();

            }

        },800);

    }

    stop(){

        clearInterval(this.timer);

        this.timer = null;

        this.running = false;

    }

}