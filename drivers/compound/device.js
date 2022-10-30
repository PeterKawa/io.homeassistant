'use strict';

const Homey = require('homey');

const CAPABILITIES_SET_DEBOUNCE = 100;

const defaultValueConverter = {
    from: (state) => parseFloat(state),
    to: (value) => value
}

const defaultStringConverter = {
    from: (state) => state,
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

        // Capability listener for all existing capabilities
        this.registerMultipleCapabilityListener(this.getCapabilities(), async (value, opts) => {
            await this._onCapabilitiesSet(value, opts)
        }, CAPABILITIES_SET_DEBOUNCE);

        // maintenance actions
        this.registerCapabilityListener('button.reconnect', async () => {
            await this.clientReconnect()
        });

        // Init device with a short timeout to wait for initial entities
        this.timeoutInitDevice = this.homey.setTimeout(async () => this.onInitDevice().catch(e => console.log(e)), 5 * 1000 );
    }

    async updateCapabilities(){
        // Add new capabilities (if not already added)
        if (!this.hasCapability('button.reconnect'))
        {
          await this.addCapability('button.reconnect');
        }
    }

    getCapabilityType(capability){
        let type = typeof(this.getCapabilityValue(capability));
        if (type == 'string' || type == 'number' || type == 'boolean'){
            return type;
        }
        else{
            if (capability.startsWith("measure_generic")){
                return "string";
            }
            else if( capability.startsWith("measure_") ||
                capability.startsWith("meter_") ||
                capability == "dim" ) {
                return "number";
            } 
            else {
                return "boolean";
            }
        }
    }

    getAutocompleteCapabilityList(){
        let capabilities = this.getCapabilities();
        let result = [];
        for (let i=0; i<capabilities.length; i++){
            if (capabilities[i] != "button.reconnect"){
                let name = capabilities[i] + " ("+this.compoundCapabilities[capabilities[i]]+")";
                result.push({
                    id: capabilities[i],
                    name: name
                })
            }
        }
        return result;
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

        switch (this.getCapabilityType(capability)){
            case "string":
                return defaultStringConverter.from;
            case "number":
                return defaultValueConverter.from;
            case "boolean":
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

        switch (this.getCapabilityType(capability)){
            case "string":
                return defaultStringConverter.to;
            case "number":
                return defaultValueConverter.to;
            case "boolean":
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
            
            Object.keys(this.compoundCapabilities).forEach(async (key) => {
                if(this.compoundCapabilities[key] == entityId) {
    
                    // console.log("---------------------------------------------------------------");
                    // console.log("update compound device:", this.entityId);
                    // console.log("update compound capability:", key);
                    // console.log("update compound by entity:", entityId);
    
                    let convert = this.inputConverter(key);
                    let value = convert(data.state);
                    if (value == null || value == undefined)
                        this.log("Update compound device. Value convert error: "+this.entityId+" key: "+key+" entity: "+entityId+" HA state: "+data.state+" converted:"+value);
    
                    try {
                        let oldValue = this.getCapabilityValue(key);
                        await this.setCapabilityValue(key, value);
                        if (oldValue!=value){
                            // trigger flow
                            let state = {
                                capability: {
                                    id: key
                                }
                            };
                            let tokens = {
                                capability: key,
                                value_string: '',
                                value_number: 0,
                                value_boolean: false
                            };
                            switch (this.getCapabilityType(key)){
                                case "string":
                                    tokens.value_string = value;
                                    break;
                                case "number":
                                    tokens.value_number = value;
                                    break;
                                case "boolean":
                                    tokens.value_boolean = value;
                                    break;
                            }
                            this.homey.app._flowTriggerCapabilityChanged.trigger(this, tokens, state);
                        }
                    }
                    catch(error) {
                        this.error("Update compound device error: "+this.entityId+" key: "+key+" entity: "+entityId+" value:"+value+" error: "+error.message);
                    }
                 }
            });
                
        }
        catch(error) {
            this.error("CapabilitiesUpdate error: "+ error.message);
        }
    }

    async _onCapabilitiesSet(valueObj, optsObj) {
        try{
            let keys = Object.keys(valueObj);
            for (let i=0; i<keys.length; i++){
                let key = keys[i];
                if (key.startsWith("onoff")){
                    this.onCapabilityOnoff(key, valueObj[keys[i]]);
                }
                if (key.startsWith("button") && key != "button.reconnect"){
                    this.onCapabilityButton(key);
                }
                if (key.startsWith("locked")){
                    this.onCapabilityLocked(key, valueObj[keys[i]]);
                }
                if (key.startsWith("dim")){
                    this.onCapabilityDim(key, valueObj[keys[i]]);
                }
    
            }
        }
        catch(error) {
            this.error("CapabilitiesUpdate error: "+ error.message);
        }

    }

    async onCapabilityButton( capability, value, opts ) {
        await this._client.turnOnOff(this.compoundCapabilities[capability], true);
    }


    async onCapabilityOnoff( capability, value, opts ) {
        await this._client.turnOnOff(this.compoundCapabilities[capability], value);
    }

    async onCapabilityLocked( capability, value, opts ) {
        console.log("onCapabilityLocked", value);
        await this._client.turnOnOff(this.compoundCapabilities[capability], value);
    }

    async onCapabilityDim( capability, value, opts ) {
        let entityId = this.compoundCapabilities[capability];
        let outputValue = this.outputConverter("dim")(value);
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