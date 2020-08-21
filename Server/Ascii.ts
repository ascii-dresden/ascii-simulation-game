import { Room, Client } from "colyseus";
import { type, Schema, MapSchema } from '@colyseus/schema';

let hitbox = new Set();

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
	
	//fills hitbox set with its values
	fillHitbox() {
		hitbox.add([1,1]).add([2,1]);
	}
	//Message Handlers
	onServe (client: Client, data : any) {
		this.state.currentBeverage = data;
    console.log(client.sessionId + " served: " +  this.state.currentBeverage);
	}
	
	//move messages say the client tried to walk 1 space to given direction
	//collision check at server, update position AND rotation
	onMove (client: Client, data : any) {
		//position if the move would go through
		var x : number = this.state.players[client.sessionId].x;
		var y : number = this.state.players[client.sessionId].y;
		var rotation : number = 0;
		switch(data){
			case "left":
				rotation = 3;
				x = x - 1;
				break;
			case "right":
				rotation = 1;
				x = x + 1;
				break;
			case "up":
				rotation = 0;
				y = y + 1;
				break;
			case "down":
				rotation = 2;
				y = y - 1;
				break;
		}
		if (hitbox.has([x,y])) { return; }
		this.state.players[client.sessionId].x = x;
		this.state.players[client.sessionId].y = y;
		this.state.players[client.sessionId].rotation = rotation;
	}
	
	onCreate (options: any) {
	  //fill hitbox with all its values
	  this.fillHitbox();
		this.setState(new State());
		//link Message Handlers
    this.onMessage("serve", (client, message) => { this.onServe(client,message) });
    this.onMessage("move", (client, message) => { this.onMove(client,message) });

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
