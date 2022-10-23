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

    onInit() {
        this._client = this.homey.app.getClient();

        this.entityId = this.getData().id;
        this.capabilities = this.getCapabilities();
        this.compoundCapabilities = this.getData().capabilities;
        this.compoundCapabilitiesConverters = this.getData().capabilitiesConverters;

        this.log('device init');
        this.log('id:', this.entityId);
        this.log('name:', this.getName());
        this.log('class:', this.getClass());

        this._client.registerDevice(this.entityId, this);

        if(this.hasCapability("button")) {
            this.registerCapabilityListener('button', async (value, opts) => {this.onCapabilityButton(value, opts)});
        }

        if(this.hasCapability("onoff")) {
            this.registerCapabilityListener('onoff', async (value, opts) => {this.onCapabilityOnoff(value, opts)});
        }

        if(this.hasCapability("locked")) {
            this.registerCapabilityListener('locked', async (value, opts) => {this.onCapabilityLocked(value, opts)});
        }

        if(this.hasCapability("dim")) {
            console.log("attach dim listener");
            this.registerCapabilityListener('dim', async (value, opts) => {this.onCapabilityDim(value, opts)});
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
            capability == "dim") {
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

        if(capability.startsWith("measure_" ||
            capability == "dim")) {
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

    onEntityUpdate(data) {
        let entityId = data.entity_id;

        Object.keys(this.compoundCapabilities).forEach(key => {
            if(this.compoundCapabilities[key] == entityId) {

                // console.log("---------------------------------------------------------------");
                // console.log("update compound device:", this.entityId);
                // console.log("update compound capability:", key);
                // console.log("update compound by entity:", entityId);

                let convert = this.inputConverter(key);

                this.setCapabilityValue(key, convert(data.state));
            }
        });
    }

    onCapabilityButton( value, opts ) {
        this._client.turnOnOff(this.compoundCapabilities["button"], true);
    }


    onCapabilityOnoff( value, opts ) {
        this._client.turnOnOff(this.compoundCapabilities["onoff"], value);
    }

    onCapabilityLocked( value, opts ) {
        console.log("onCapabilityLocked", value);
        this._client.turnOnOff(this.compoundCapabilities["locked"], value);
    }

    onCapabilityDim( value, opts ) {
        let entityId = this.compoundCapabilities["dim"];
        let outputValue = this.outputConverter("dim")(value);

        // TODO: make service calls configurable to allow other types then just input_number
        
        this._client.callService("input_number", "set_value", {
            "entity_id": entityId,
            "value": outputValue
        });
    }
}

module.exports = CompoundDevice;