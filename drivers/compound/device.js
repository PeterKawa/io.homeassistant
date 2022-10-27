'use strict';

const Homey = require('homey');

const defaultValueConverter = {
    from: (state) => parseFloat(state),
    to: (value) => value
}

const defaultBooleanConverter = {
    from: (state) => (state == "on"),
    to: (value) => (value ? "on" : "off")
}

class CompoundDevice extends Homey.Device {

    async onInit() {
        this._client = this.homey.app.getClient();

        await this.updateCapabilities();

        this.entityId = this.getData().id;
        this.capabilities = this.getCapabilities();
        this.compoundCapabilities = this.getData().capabilities;
        this.compoundCapabilitiesConverters = this.getData().capabilitiesConverters;

        this.log('Device init. ID: '+this.entityId+" Name: "+this.getName()+" Class: "+this.getClass());

        this._client.registerDevice(this.entityId, this);

        if(this.hasCapability("button")) {
            this.registerCapabilityListener('button', async (value, opts) => {
                await this.onCapabilityButton(value, opts)
            });
        }

        if(this.hasCapability("onoff")) {
            this.registerCapabilityListener('onoff', async (value, opts) => {
                await this.onCapabilityOnoff(value, opts)
            });
        }

        if(this.hasCapability("locked")) {
            this.registerCapabilityListener('locked', async (value, opts) => {
                await this.onCapabilityLocked(value, opts)
            });
        }

        if(this.hasCapability("dim")) {
            this.registerCapabilityListener('dim', async (value, opts) => {
                await this.onCapabilityDim(value, opts)
            });
        }

        // maintenance actions
        this.registerCapabilityListener('button.reconnect', async () => {
            await this.clientReconnect()
        });

        // Init device with a short timeout to wait for initial entities
        this.timeoutInitDevice = setTimeout(async () => this.onInitDevice().catch(e => console.log(e)), 5 * 1000 );
    }

    async updateCapabilities(){
        // Add new capabilities (if not already added)
        if (!this.hasCapability('button.reconnect'))
        {
          await this.addCapability('button.reconnect');
        }
    }

    inputConverter(capability) {
        let capabilityConverter = this.compoundCapabilitiesConverters[capability];

        if(capabilityConverter != null) {
            if(capabilityConverter.from && typeof capabilityConverter.from === "function") {
                return capabilityConverter.from;
            } else if(capabilityConverter.from && typeof capabilityConverter.from === "string") {
                capabilityConverter.from = eval(capabilityConverter.from);
                return capabilityConverter.from;
            }
        }

        if(capability.startsWith("measure_") ||
            capability == "dim" || 
            capability == "volume_set" ) {
            return defaultValueConverter.from;
        } else {
            return defaultBooleanConverter.from;
        }
    }

    outputConverter(capability) {
        let capabilityConverter = this.compoundCapabilitiesConverters[capability];
        if(capabilityConverter != null) {
            if(capabilityConverter.to && typeof capabilityConverter.to === "function") {
                return capabilityConverter.to;
            } else if(capabilityConverter.to && typeof capabilityConverter.to === "string") {
                capabilityConverter.to = eval(capabilityConverter.to);
                return capabilityConverter.to;
            }
        }

        if(capability.startsWith("measure_") ||
            capability == "dim" || 
            capability == "volume_set" ) {
            return defaultValueConverter.to;
        } else {
            return defaultBooleanConverter.to;
        }
    }

    onAdded() {
        this.log('device added');
    }

    onDeleted() {
        this.log('device deleted');
        this._client.unregisterDevice(this.entityId);
    }

    async onInitDevice(){
        // Init device on satrtup with latest data to have initial values before HA sends updates
        this.log('Device init data. ID: '+this.entityId+" Name: "+this.getName()+" Class: "+this.getClass());
        
        Object.keys(this.compoundCapabilities).forEach(key => {
            let entity = this._client.getEntity(this.compoundCapabilities[key]);
            if (entity){
                this.onEntityUpdate(entity);
            }
        });

    }

    async onEntityUpdate(data){
        try {
            let entityId = data.entity_id;
            
            Object.keys(this.compoundCapabilities).forEach(key => {
                if(this.compoundCapabilities[key] == entityId) {
    
                    // console.log("---------------------------------------------------------------");
                    // console.log("update compound device:", this.entityId);
                    // console.log("update compound capability:", key);
                    // console.log("update compound by entity:", entityId);
    
                    let convert = this.inputConverter(key);
                    let value = convert(data.state);

                    this.log("Update compound device: "+this.entityId+" key: "+key+" entity: "+entityId+" value:"+value);
    
                    this.setCapabilityValue(key, value);
                }
            });
                
        }
        catch(error) {
            this.error("Device update error: "+ error.message);
        }
    }

    async onCapabilityButton( value, opts ) {
        await this._client.turnOnOff(this.compoundCapabilities["button"], true);
    }


    async onCapabilityOnoff( value, opts ) {
        await this._client.turnOnOff(this.compoundCapabilities["onoff"], value);
    }

    async onCapabilityLocked( value, opts ) {
        console.log("onCapabilityLocked", value);
        await this._client.turnOnOff(this.compoundCapabilities["locked"], value);
    }

    async onCapabilityDim( value, opts ) {
        let entityId = this.compoundCapabilities["dim"];
        let outputValue = this.outputConverter("dim")(value);

        // TODO: make service calls configurable to allow other types then just input_number
        
        await this._client.callService("input_number", "set_value", {
            "entity_id": entityId,
            "value": outputValue
        });
    }

    async clientReconnect(){
        await this.homey.app.clientReconnect();
    }
}

module.exports = CompoundDevice;