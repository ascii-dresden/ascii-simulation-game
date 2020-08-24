import { Room, Client } from "colyseus";
import { type, Schema, MapSchema } from '@colyseus/schema';

let hitbox = new Set();


class int extends Schema {
	@type("number") value : number;
}	

//a single player
class Player extends Schema {
	@type("number") x : number = 2;	//players start behind the counter
	@type("number") y : number = 1;
	@type("string") inventory : string = "Empty";
	@type("number") rotation : number = 0;
}

//state of the game in the current room
class State extends Schema {
	@type({ map: Player }) players = new MapSchema<Player>();
	@type({ map: int }) Resources = new MapSchema<int>();
	//function to create a new player for given id  
	createPlayer (id: string) { this.players[ id ] = new Player(); }
}

export class Ascii extends Room {
	
	fillResources() {
		let integ = new int();
		integ.value = 5;
		this.state.Resources["Kolle"] = integ;
		this.state.Resources["Premium"] = integ;
	}
	
	//fills hitbox set with its values forma: x*10+y
	fillHitbox() {
		//main counter
		hitbox.add(10).add(11).add(12).add(13).add(14).add(15).add(16).add(17);
		//top counter
		hitbox.add(27).add(37).add(47).add(57).add(67).add(77).add(87).add(97);
		//right side
		hitbox.add(96).add(95).add(94).add(93).add(92).add(91).add(90);
		//counter with cofee machine
		hitbox.add(46).add(45).add(44).add(43).add(42).add(41);
		//storage + fridge
		hitbox.add(55).add(54).add(53).add(52);
	}
	
	//returns a map of all requirements for the given product
	requires(Product : string) {
		let output = new Map<string,number>()
		output.set(Product,1);
		return output;
	}
	
	consume(Product : string) {
		let requirement = this.requires(Product);
		//check if every resource is available
		for (let resource of requirement.keys()) {
			if (this.state.Resources[resource].value < requirement.get(resource)) { return false; } }
		//consume Resources
		for (let resource of requirement.keys()) {
			this.state.Resources[resource].value = this.state.Resources[resource].value - requirement.get(resource); }
		return true;
	}
	
	//Message Handlers
	//Pcikup
	onPickup (client : Client, data : any) {
		if (this.state.players[client.sessionId].inventory != "Empty") { return; }
		if (!this.consume(data)) { return false; }
		this.state.players[client.sessionId].inventory = data;
	}
	
	onDrop (client: Client, data : any) {
		if (this.state.players[client.sessionId].inventory == "Empty") { return; }
		//TODO: do something usefull
		this.state.players[client.sessionId].inventory = "Empty";
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
		this.state.players[client.sessionId].rotation = rotation;
		//collision check
		if (x < 0 || y < 0) { return; }
		if (hitbox.has(x*10+y)) { return; }
		this.state.players[client.sessionId].x = x;
		this.state.players[client.sessionId].y = y;
	}
	
  onCreate (options: any) {
		//fill hitbox with all its values
		this.fillHitbox();
		this.setState(new State());
		this.fillResources();
		//link Message Handlers
    this.onMessage("move", (client, message) => { this.onMove(client,message) });
  	this.onMessage("pickup", (client, message) => { this.onPickup(client,message) });
  	this.onMessage("drop", (client, message) => { this.onDrop(client,message) });
  }

  onJoin (client: Client, options: any) {
  	client.send("id",client.sessionId);
  	this.state.createPlayer(client.sessionId);
  }

  onLeave (client: Client, consented: boolean) {
  	delete this.state.players[client.sessionId]
  }

  onDispose() {
  }

}
