import { Room, Client } from "colyseus";
import { type, Schema, MapSchema } from '@colyseus/schema';

//a single player
class Player extends Schema {
	@type("number") x : number = 0;
	@type("number") y : number = 0;
	@type("string") inventory : string = "Empty";
	@type("number") rotation : number = 0;
}

//state of the game in the current room
class State extends Schema {
	//demo for server connection
	@type("string") currentBeverage: string = "Nothing";
	//list of all players
	@type({ map: Player }) players = new MapSchema<Player>();
	//function to create a new player for given id  
	createPlayer (id: string) { this.players[ id ] = new Player(); }
}

export class Ascii extends Room {
	
	//Message Handlers
	onServe (client: Client, data : any) {
		this.state.currentBeverage = data;
    console.log(client.sessionId + " served: " +  this.state.currentBeverage);
	}
	
	 onCreate (options: any) {
		this.setState(new State());
		//link Message Handlers
    this.onMessage("serve", (client, message) => { this.onServe(client,message) });

  }

  onJoin (client: Client, options: any) {
  	this.state.createPlayer(client.sessionId);
  }

  onLeave (client: Client, consented: boolean) {
  	delete this.state.players[client.sessionId]
  }

  onDispose() {
  }

}
