if (process.env.DEBUG === '1')
{
    require('inspector').open(9225, '0.0.0.0', true);
}

'use strict';

const Homey = require('homey');
const Client = require('./lib/Client.js');

class App extends Homey.App {
	
	onInit() {
		super.onInit();

		this.log('Home-Assistant is running...');

		// Init client and connect
		let address = this.homey.settings.get("address");
		let token = this.homey.settings.get("token");

		this._client = new Client(address, token)
		this._client.on("connection_update", (state) => {
				this.homey.api.realtime('connection_update', state);
			});
		this._client.connect(address, token, false).catch((error) => {this.error("Connect error: "+ error);} );

		// Register Flowcards
		this._flowActionCallService = this.homey.flow.getActionCard('callService')
		this._flowActionCallService.registerRunListener(async (args, state) => {
			try{
				this._onFlowActionCallService;
			}
			catch(error){
				this.error("Error executing flowAction 'callService': "+  error.message);
				throw error;
			}
		});

		// App events
		this.homey.settings.on("set", async (key) =>  {
			if (key = "login" && this.homey.settings.get("login") == true){
				await this.homey.settings.set("login", false);
				await this._reconnectClient();
			}
		});
	}

	getClient() {
		return this._client;
	}

	async _reconnectClient() {
		console.log("settings updated.... reconnecting");

		let address = this.homey.settings.get("address");
		let token = this.homey.settings.get("token");

		try{
			await this._client.connect(address, token, true);
		}
		catch(error){
			this.error("Connect error: "+ error.message);
		}
	}

	_onFlowActionCallService(args) {
		this._client.callService(args.domain, args.service, args.data);
	}

	async clientReconnect(){
		await this._reconnectClient();
	}
}

module.exports = App;