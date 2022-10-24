'use strict';

const Homey = require('homey');

class BinarySensorDevice extends Homey.Device {

    async onInit() {
        await this.updateCapabilities();

        this._client = this.homey.app.getClient();

        this.entityId = this.getData().id;
        this.capabilities = this.getCapabilities();

        this.log('device init');
        this.log('id:', this.entityId);
        this.log('name:', this.getName());
        this.log('class:', this.getClass());

        this._client.registerDevice(this.entityId, this);

        let entity = this._client.getEntity(this.entityId);
        if(entity) { 
            this.onEntityUpdate(entity);
        }

        this.registerCapabilityListener('onoff', async (value, opts) => {this.onCapabilityOnoff(value, opts);})
        // maintenance actions
        this.registerCapabilityListener('button.reconnect', async () => {this.clientReconnect()});
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

    onEntityUpdate(data) {
        try {

            this.capabilities.forEach(capability => {
                this.setCapabilityValue(capability, data.state == "on");
            });
            
        } catch(ex) {
            console.log("error", ex);
        }
    }

    onCapabilityOnoff( value, opts ) {
        let oldValue = this.getCapabilityValue('onoff');
        this.setCapabilityValue("onoff", oldValue);
    }

    async clientReconnect(){
        await this.homey.app.clientReconnect();
    }
}

module.exports = BinarySensorDevice;