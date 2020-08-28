import { Room, Client } from "colyseus";
import { type, Schema, MapSchema, ArraySchema } from '@colyseus/schema';
const csv = require('csv-parser')
const fs = require('fs')

var Requirements = new Map();
var max = new Map([ //needs to have exactly the entries of the csv
			["Milch",5],["Kaffeebohnen",5],["Espresso Bohnen",5],["Schokopulver",5],["Weiße Schokolade",5],
			["Kolle",3],["Premium",3],["Zotrine",3]]);
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
	@type({ map: Player }) players = new MapSchema<Player>();
	@type({ map: "number" }) Resources = new MapSchema<number>();
	//function to create a new player for given id  
	createPlayer (id: string) { this.players[ id ] = new Player(); }
	@type([Customer]) customers = new ArraySchema<Customer>();
	createCustomer (wants: MapSchema<number>) { this.customers.push(new Customer(wants)); }


}

export class Ascii extends Room {
	
	fillResources() {
		for (let item of max.keys()) {
		this.state.Resources[item] = max.get(item);
		}
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
	
	//returns false if not enough Resources were available
	consume(Product : string) {
		if (!Requirements.has(Product)) { return false; }
		let requirement = Requirements.get(Product);
		//check if every resource is available
		for (let resource of requirement.keys()) {
			if (this.state.Resources[resource] < requirement.get(resource)) { return false; } }
		//consume Resources
		for (let resource of requirement.keys()) {
			this.state.Resources[resource] = this.state.Resources[resource] - requirement.get(resource); }
		return true;
	}
	
	//one type of "Use"
	Produce (client : Client, data : string) {
		if (this.state.players[client.sessionId].inventory != "Empty") { return; }
		if (!this.consume(data)) { return; }
		this.state.players[client.sessionId].inventory = data;
	}
	
	//Message Handlers	
	onUse(client : Client, data : any) {
		let player = this.state.players[client.sessionId];
		if (player.x * 10 + player.y == 84 && player.rotation == 1)
			{ this.Produce(client,"Kolle"); return; }
		if (player.x * 10 + player.y == 85 && player.rotation == 1)
			{ this.Produce(client,"Premium"); return; }
		if (player.x * 10 + player.y == 86 && player.rotation == 1)
			{ this.Produce(client,"Premium"); return; }
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
		this.generateCustomer();
	}
	
	onRefill(client: Client, data : any) {
		if (data == "all") { this.fillResources(); return; }
		if (!max.has(data)) { return; }
		this.state.Resources[data] = max.get(data);
	}
	
  onCreate (options: any) {
  	//read file
  	fs.createReadStream('Resources.csv')
  	.pipe(csv())
  	.on('data', (data : any) => {	//data contains a single line of the csv as "object" (behaves like struct)
  		let name : string = data["Getränk"]
  		let req = new Map();
		for (let resource of max.keys()) {
			if (data[resource] == '') { continue; }
			req.set(resource,parseInt(data[resource]));
		}
		Requirements.set(name,req);
  	}).on('end', () => {	//callback after reading
  		this.fillResources();
  		//link Message Handlers
		this.onMessage("move", (client, message) => { this.onMove(client,message) });
	  	this.onMessage("use", (client, message) => { this.onUse(client,message) });
	  	this.onMessage("drop", (client, message) => { this.onDrop(client,message) });
	  	this.onMessage("refill", (client, message) => { this.onRefill(client,message) });
	});
	//fill hitbox with all its values
	this.fillHitbox();
	this.setState(new State());
	
	this.onMessage("*", (client, essage) => { console.log("Server isnt finished yet"); });
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
  	if (this.state.customers.length >= 8) { return; }
	  var random : number = Math.floor(Math.random() * 10) // numbers between 0 and 10
	  if(random > 7){
	  	let wants = new MapSchema<number>();
	  	wants["Kolle"] = 1;
			this.state.createCustomer(wants)
	  }
  }

}
