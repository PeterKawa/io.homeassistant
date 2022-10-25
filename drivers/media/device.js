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

class MediaDevice extends Homey.Device {

    async onInit() {
        this._client = this.homey.app.getClient();

        await this.updateCapabilities();

        this.entityId = this.getData().id;
        this.capabilities = this.getCapabilities();

        this.log('device init');
        this.log('id:', this.entityId);
        this.log('name:', this.getName());
        this.log('class:', this.getClass());

        this._client.registerDevice(this.entityId, this);

        // if(this.hasCapability("button")) {
        //     this.registerCapabilityListener('button', async (value, opts) => {this.onCapabilityButton(value, opts)});
        // }

        if(this.hasCapability("onoff")) {
            this.registerCapabilityListener('onoff', async (value, opts) => {this.onCapabilityOnoff(value, opts)});
        }

        if(this.hasCapability("volume_set")) {
            this.registerCapabilityListener('volume_set', async (value, opts) => {this.onCapabilityVolumeSet(value, opts)});
        }
        if(this.hasCapability("volume_up")) {
            this.registerCapabilityListener('volume_up', async (value, opts) => {this.onCapabilityVolumeUp(value, opts)});
        }
        if(this.hasCapability("volume_down")) {
            this.registerCapabilityListener('volume_down', async (value, opts) => {this.onCapabilityVolumeDown(value, opts)});
        }
        if(this.hasCapability("volume_mute")) {
            this.registerCapabilityListener('volume_mute', async (value, opts) => {this.onCapabilityVolumeMute(value, opts)});
        }
        if(this.hasCapability("speaker_playing")) {
            this.registerCapabilityListener('speaker_playing', async (value, opts) => {this.onCapabilitySpeakerPlaying(value, opts)});
        }
        if(this.hasCapability("speaker_next")) {
            this.registerCapabilityListener('speaker_next', async (value, opts) => {this.onCapabilitySpeakerNext(value, opts)});
        }
        if(this.hasCapability("speaker_prev")) {
            this.registerCapabilityListener('speaker_prev', async (value, opts) => {this.onCapabilitySpeakerPrev(value, opts)});
        }
        if(this.hasCapability("speaker_shuffle")) {
            this.registerCapabilityListener('speaker_shuffle', async (value, opts) => {this.onCapabilitySpeakerShuffle(value, opts)});
        }
        if(this.hasCapability("speaker_repeat")) {
            this.registerCapabilityListener('speaker_repeat', async (value, opts) => {this.onCapabilitySpeakerRepeat(value, opts)});
        }

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

    inputConverter(capability) {
        // let capabilityConverter = this.compoundCapabilitiesConverters[capability];

        // if(capabilityConverter != null) {
        //     if(capabilityConverter.from && typeof capabilityConverter.from === "function") {
        //         return capabilityConverter.from;
        //     } else if(capabilityConverter.from && typeof capabilityConverter.from === "string") {
        //         capabilityConverter.from = eval(capabilityConverter.from);
        //         return capabilityConverter.from;
        //     }
        // }

        if(capability.startsWith("measure_") ||
            capability == "volume_set" ) {
            return defaultValueConverter.from;
        } else {
            return defaultBooleanConverter.from;
        }
    }

    outputConverter(capability) {
        // let capabilityConverter = this.compoundCapabilitiesConverters[capability];
        // if(capabilityConverter != null) {
        //     if(capabilityConverter.to && typeof capabilityConverter.to === "function") {
        //         return capabilityConverter.to;
        //     } else if(capabilityConverter.to && typeof capabilityConverter.to === "string") {
        //         capabilityConverter.to = eval(capabilityConverter.to);
        //         return capabilityConverter.to;
        //     }
        // }

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
        let entity = this._client.getEntity(this.entityId);
        this.onEntityUpdate(entity);
    }

    onDeleted() {
        this.log('device deleted');
        this._client.unregisterDevice(this.entityId);
    }

    onEntityUpdate(data) {
        let entityId = data.entity_id;
        if(data) {

            let convert = null;

            if (this.hasCapability("volume_set") && data.attributes.volume_level != null){
                convert = this.inputConverter("volume_set");
                this.setCapabilityValue("volume_set", convert(data.attributes.volume_level));
            }
            if (this.hasCapability("volume_mute") && data.attributes.is_volume_muted != null){
                    this.setCapabilityValue("volume_mute", data.attributes.is_volume_muted);
            }
            if (this.hasCapability("speaker_playing") && data.state != null){
                switch (data.state){
                    case "playing":
                        this.setCapabilityValue("speaker_playing", true);
                        break;
                    default:
                        this.setCapabilityValue("speaker_playing", false);
                }
            }
            if (this.hasCapability("speaker_shuffle")){
                if (data.attributes.shuffle != null){
                    this.setCapabilityValue("speaker_shuffle", data.attributes.shuffle );
                }
                else{
                    this.setCapabilityValue("speaker_shuffle", false );
                }
            }
            if (this.hasCapability("speaker_repeat")){
                if (data.attributes.repeat != null){
                    switch (data.attributes.repeat){
                        case "off":
                            this.setCapabilityValue("speaker_repeat", "none");
                            break;
                        case "one":
                            this.setCapabilityValue("speaker_repeat", "track");
                            break;
                        case "all":
                            this.setCapabilityValue("speaker_repeat", "playlist");
                            break;
                        default:
                            this.setCapabilityValue("speaker_repeat", "none");
                    }
                }
                else{
                    this.setCapabilityValue("speaker_repeat", "none");
                }
            }
            if (this.hasCapability("speaker_artist") && data.attributes.media_artist != null){
                this.setCapabilityValue("speaker_artist", data.attributes.media_artist);
            }
            if (this.hasCapability("speaker_album") && data.attributes.media_album_name != null){
                this.setCapabilityValue("speaker_album", data.attributes.media_album_name);
            }
            if (this.hasCapability("speaker_track") && data.attributes.media_title != null){
                this.setCapabilityValue("speaker_track", data.attributes.media_title);
            }
            if (this.hasCapability("speaker_duration") && data.attributes.media_duration != null){
                this.setCapabilityValue("speaker_duration", data.attributes.media_duration);
            }
            if (this.hasCapability("speaker_position") && data.attributes.media_position != null){
                this.setCapabilityValue("speaker_position", data.attributes.media_position);
            }

            if (this.hasCapability("onoff") && data.state != null){
                switch (data.state){
                    case "on":
                    case "idle":
                    case "playing":
                    case "paused":
                    case "buffering":
                            this.setCapabilityValue("onoff", true);
                        break;
                    case "off":
                    case "standby":
                        this.setCapabilityValue("onoff", false);
                        break;
                    default:
                        this.setCapabilityValue("onoff", false);
                }
            }

        }
    }
    // onCapabilityButton( value, opts ) {
    //     this._client.turnOnOff(this.compoundCapabilities["button"], true);
    // }


    onCapabilityOnoff( value, opts ) {
        // this._client.turnOnOff(this.entityId, value);
        let entityId = this.entityId;
        if (value == true){
            this._client.callService("media_player", "turn_on", {
                "entity_id": entityId
            });
        }
        else{
            this._client.callService("media_player", "turn_off", {
                "entity_id": entityId
            });
        }
    }

    onCapabilityVolumeSet( value, opts ) {
        let entityId = this.entityId;
        let outputValue = this.outputConverter("volume_set")(value);
        this._client.callService("media_player", "volume_set", {
            "entity_id": entityId,
            "volume_level": outputValue
        });
    }

    onCapabilityVolumeUp( value, opts ) {
        let volume = this.getCapabilityValue("volume_set");
        volume = volume + 0.05;
        if (volume > 1){
            volume = 1;
        }
        this.onCapabilityVolumeSet( volume , opts);
    }

    onCapabilityVolumeDown( value, opts ) {
        let volume = this.getCapabilityValue("volume_set");
        volume = volume - 0.05;
        if (volume < 0){
            volume = 0;
        }
        this.onCapabilityVolumeSet( volume , opts);
    }

    onCapabilityVolumeMute( value, opts ) {
        let entityId = this.entityId;
        let outputValue = value;
        this._client.callService("media_player", "volume_mute", {
            "entity_id": entityId,
            "is_volume_muted": outputValue
        });
    }

    onCapabilitySpeakerPlaying( value, opts ) {
        let entityId = this.entityId;
        let outputValue = value;
        if (outputValue){
            this._client.callService("media_player", "media_play", {
                "entity_id": entityId
            });
        }
        else{
            this._client.callService("media_player", "media_play_pause", {
                "entity_id": entityId
            });
        }
    }

    onCapabilitySpeakerNext( value, opts ) {
        let entityId = this.entityId;
        this._client.callService("media_player", "media_next_track", {
            "entity_id": entityId
        });
    }

    onCapabilitySpeakerPrev( value, opts ) {
        let entityId = this.entityId;
        this._client.callService("media_player", "media_previous_track", {
            "entity_id": entityId
        });
    }

    onCapabilitySpeakerShuffle( value, opts ) {
        let entityId = this.entityId;
        let outputValue = value;
        this._client.callService("media_player", "shuffle_set", {
            "entity_id": entityId,
            "shuffle": outputValue
        });
    }

    onCapabilitySpeakerRepeat( value, opts ) {
        let entityId = this.entityId;
        let outputValue = "off";
        switch (value){
            case "none":
                outputValue = "off";
                break;
            case "track":
                outputValue = "one";
                break;
            case "playlist":
                outputValue = "all";
                break;
        }
        
        this._client.callService("media_player", "repeat_set", {
            "entity_id": entityId,
            "is_volume_muted": outputValue
        });
    }


    async clientReconnect(){
        await this.homey.app.clientReconnect();
    }
}

module.exports = MediaDevice;