'use strict';

const Homey = require('homey');

class SensorDevice extends Homey.Device {

    async onInit() {
        await this.updateCapabilities();

        this._client = this.homey.app.getClient();

        this.entityId = this.getData().id;
        this.capability = this.getCapabilities()[0];

        this.log('Device init. ID: '+this.entityId+" Name: "+this.getName()+" Class: "+this.getClass());

        this._client.registerDevice(this.entityId, this);

        let entity = this._client.getEntity(this.entityId);
        if(entity) { 
            this.onEntityUpdate(entity);
        }

        // maintenance actions
        this.registerCapabilityListener('button.reconnect', async () => {
            await this.clientReconnect()
        });
    }

    async updateCapabilities(){
        // Add new capabilities (if not already added)
        if (!this.hasCapability('button.reconnect'))
        {
          await this.addCapability('button.reconnect');
        }
    }

    onAdded() {
        this.log('device added');
    }

    onDeleted() {
        this.log('device deleted');
        this._client.unregisterDevice(this.entityId);
    }

    async onEntityUpdate(data) {
        try {
            switch(this.capability) {
                case "measure_generic":
                    await this.setCapabilityValue(this.capability, data.state);
                    break;
                default:
                    await this.setCapabilityValue(this.capability, parseFloat(data.state));
            }
        }
        catch(ex) {
            this.log("error", ex);
        }
    }

    async clientReconnect(){
        await this.homey.app.clientReconnect();
    }
}

module.exports = SensorDevice;