'use strict';

const Homey = require('homey');

const CAPABILITIES_SET_DEBOUNCE = 100;

class LightDevice extends Homey.Device {

    onInit() {
        this._client = this.homey.app.getClient();

        this.entityId = this.getData().id;

        this._minMireds = 0;
        this._maxMireds = 0;

        this.log('device init');
        this.log('id:', this.entityId);
        this.log('name:', this.getName());
        this.log('class:', this.getClass());

        this._client.registerDevice(this.entityId, this);

        let entity = this._client.getEntity(this.entityId);
        if(entity) { 
            this.onEntityUpdate(entity);
        }

        this.registerMultipleCapabilityListener(this.getCapabilities(), async (value, opts) => {this._onCapabilitiesSet(value, opts)}, CAPABILITIES_SET_DEBOUNCE);
    }

    onAdded() {
        this.log('device added');
    }

    onDeleted() {
        this.log('device deleted');
        this._client.unregisterDevice(this.entityId);
    }

    onCapabilityOnoff( value, opts ) {
        this._client.turnOnOff(this.entityId, value);
    }

    getCapabilityUpdate(valueObj, capability) {
        let value = valueObj[capability];
        if(typeof value === 'undefined') value = this.getCapabilityValue(capability)

        return value;
    }

    hasCapabilityUpdate(valueObj, capability) {
        let value = valueObj[capability];
        return(typeof value !== 'undefined');
    }

    _onCapabilitiesSet(valueObj, optsObj) {
        if( typeof valueObj.dim === 'number' ) {
			valueObj.onoff = valueObj.dim > 0;	
		}

        let lightOn = this.getCapabilityUpdate(valueObj, "onoff");

        let data = {
            entity_id: this.entityId
        };

        if(lightOn) {

            if(this.hasCapability("dim")) {
                let bri = this.getCapabilityUpdate(valueObj, "dim");
                if(bri != this.getCapabilityValue("dim")) {
                    data["brightness"] = bri * 250.0;

                    this.setCapabilityValue("dim", bri)
                        .catch(error => {
                            this.error("Device "+this.getName()+": Error set dim capability, value: "+bri+" Error: "+error.message);
                        });
                }
            }

            let lightModeUpdate = null;

            if(this.hasCapabilityUpdate(valueObj, "light_hue") || 
               this.hasCapabilityUpdate(valueObj, "light_saturation")) {

                lightModeUpdate = "color";

                let hue = this.getCapabilityUpdate(valueObj, "light_hue");
                let sat = this.getCapabilityUpdate(valueObj, "light_saturation");

                if(hue != this.getCapabilityValue("light_hue") ||
                   sat != this.getCapabilityValue("light_saturation")) {

                    data["hs_color"] = [
                        hue * 360.0,
                        sat * 100.0
                    ]

                    this.setCapabilityValue("light_hue", hue)
                        .catch(error => {
                            this.error("Device "+this.getName()+": Error set hue capability, value: "+hue+" Error: "+error.message);
                        });
                    this.setCapabilityValue("light_saturation", sat)
                        .catch(error => {
                            this.error("Device "+this.getName()+": Error set saturation capability, value: "+sat+" Error: "+error.message);
                        });
            }
    
            } else if(this.hasCapabilityUpdate(valueObj, "light_temperature")) {
                lightModeUpdate = "temperature";

                let tmp = this.getCapabilityUpdate(valueObj, "light_temperature");

                if(tmp != this.getCapabilityValue("light_temperature")) {
                    data["color_temp"] = ((this._maxMireds - this._minMireds) * tmp) + this._minMireds;

                    this.setCapabilityValue("light_temperature", tmp)
                        .catch(error => {
                            this.error("Device "+this.getName()+": Error set temoerature capability, value: "+tmp+" Error: "+error.message);
                        });
            }
            }

            if(lightModeUpdate && this.hasCapability("light_mode")) {
                this.setCapabilityValue("light_mode", lightModeUpdate)
                    .catch(error => {
                        this.error("Device "+this.getName()+": Error set light mode capability, value: "+lightModeUpdate+" Error: "+error.message);
                    });
    }
        }

        this._client.updateLight(lightOn, data);

    }

    onEntityUpdate(data) {
        if(data) {

            this._minMireds = data.attributes["min_mireds"] || 0;
            this._maxMireds = data.attributes["max_mireds"] || 0;

            let lightOn = data.state == "on";

            this.setCapabilityValue("onoff", lightOn);

            if(lightOn) {

                if(this.hasCapability("dim")) {
                    let brightness = data.attributes["brightness"]; // 0..255 -> 0..1
                    if(brightness != 0) {
                        this.setCapabilityValue("dim", 1.0 / 255 * brightness)
                        .catch(error => {
                            this.error("Device "+this.getName()+": Error set dim capability, brightness value: "+brightness+" Error: "+error.message);
                        });
                    }
                }

                let hasLightMode = this.hasCapability("light_mode");
                let hs = null;
    
                if(this.hasCapability("light_hue")) {
                    hs = data.attributes["hs_color"];
                    if(hs) {
                        let hue = 1.0 / 360.0 * hs[0]; // 0..360 -> 0..1
                        let sat = 1.0 / 100.0 * hs[1]; // 0..100 -> 0..1
    
                        this.setCapabilityValue("light_hue", hue)
                            .catch(error => {
                                this.error("Device "+this.getName()+": Error set hue capability, value: "+hue+" Error: "+error.message);
                            });
                        this.setCapabilityValue("light_saturation", sat)
                            .catch(error => {
                                this.error("Device "+this.getName()+": Error set light_saturation capability, value: "+sat+" Error: "+error.message);
                            });
                    }
                }
    
                if(this.hasCapability("light_temperature")) {
                    let temperature = data.attributes["color_temp"];
                    if(temperature) {
                        let temp = 1.0 / (this._maxMireds - this._minMireds) * (temperature - this._minMireds);
                        this.setCapabilityValue("light_temperature", temp)
                            .catch(error => {
                                this.error("Device "+this.getName()+": Error set light_temperature capability, value: "+temp+" Error: "+error.message);
                            });
                }
                }
    
                if(hasLightMode) {
                    let light_mode = hs ? "color" : "temperature";
                    
                    this.setCapabilityValue("light_mode", hs ? "color" : "temperature")
                        .catch(error => {
                            this.error("Device "+this.getName()+": Error set light_mode capability, value: "+hs+" Error: "+error.message);
                        });
        }
            }
        }
    }
}

module.exports = LightDevice;