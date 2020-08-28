import { Room, Client } from "colyseus";
import { type, Schema, MapSchema, ArraySchema } from '@colyseus/schema';

let hitbox = new Set();
	
//a single player
class Player extends Schema {
	@type("number") x : number = 2;	//players start behind the counter
	@type("number") y : number = 1;
	@type("string") inventory : string = "Empty";
	@type("number") rotation : number = 0;
}

class Customer extends Schema {
	@type({ map: "number" }) wants = new MapSchema<number>();
	@type("boolean") hasPaid : boolean = false;

	constructor(wants:MapSchema<number>, hasPaid?:boolean){
		super();
		this.wants = wants;
		if(hasPaid){
			this.hasPaid = hasPaid
		}
		else{
			this.hasPaid = true
		}
	}
}

//state of the game in the current room
class State extends Schema {
	//demo for server connection
	@type("string") currentBeverage: string = "Nothing";
	//list of all players
	@type({ map: Player }) players = new MapSchema<Player>();
	//function to create a new player for given id  
	createPlayer (id: string) { this.players[ id ] = new Player(); }
	@type([Customer]) customers = new ArraySchema<Customer>();
	createCustomer (wants: MapSchema<number>) { this.customers.push(new Customer(wants)); }


}

export class Ascii extends Room {
	
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
		console.log([x,y]);
		this.state.players[client.sessionId].rotation = rotation;
		//collision check
		if (x < 0 || y < 0) { return; }
		if (hitbox.has(x*10+y)) { return; }
		this.state.players[client.sessionId].x = x;
		this.state.players[client.sessionId].y = y;
		this.generateCustomer();
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
  	client.send("id",client.sessionId);
  	this.state.createPlayer(client.sessionId);
  }

  onLeave (client: Client, consented: boolean) {
  	delete this.state.players[client.sessionId]
  }

  onDispose() {
  }

  generateCustomer(){
	  var random : number = Math.floor(Math.random() * 10) // numbers between 0 and 10
	  if(random > 7){
	  	let wants = new MapSchema<number>();
	  	wants["Kolle"] = 1;
			this.state.createCustomer(wants)
	  }
  }

}
