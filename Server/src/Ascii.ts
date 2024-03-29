import { hitbox } from "./hitbox"
import { Room, Client } from "colyseus";
import { type, Schema, MapSchema, ArraySchema } from '@colyseus/schema';

var max = new Map([["Crema_Beans",5],["Espresso_Beans",5],["Milk",6]]);


class Player extends Schema {
	@type("number") x : number = 2;	//players start behind the counter
	@type("number") y : number = 1;
	@type("string") inventory : string = "Empty";
	@type("string") rotation : string = "down";
	@type("number") money_carried : number = 0;
	@type("number") sprite : number;
	constructor(length:number,){
		super();
		this.sprite = length % 6;
	}
}

class Customer extends Schema {
	@type({ map: "number" }) wants = new MapSchema<number>();
	@type("number") pays : number = 0;
	@type("boolean") waiting : boolean = true;
	@type("number") id : number;
	@type("number") sprite_id : number;

	constructor(wants:MapSchema<number>, id:number){
		super();
		this.wants = wants;
		this.id = id;
		this.sprite_id = Math.floor(Math.random() * 7.99) + 1;

	}
}

//state of the game in the current room
class State extends Schema {
	@type({ map: Player }) players = new MapSchema<Player>();
	@type({ map: "number" }) Resources = new MapSchema<number>();
	@type("number") score = 0;
	@type("number") time = 300;
	@type("boolean") paused = true;
	//function to create a new player for given id
	createPlayer (id: string) { this.players[ id ] = new Player(this.players.size); }
	@type([Customer]) customers = new ArraySchema<Customer>();
	createCustomer (wants: MapSchema<number>, id: number) { this.customers.push(new Customer(wants, id)); }
}

export class Ascii extends Room {
	customerMaxId = 0;
	gametimer = setTimeout(()=>{},10);
	tutor = "";
	//single Tick of the Timer
	gametick() {
		this.generateCustomer();
		this.state.time--;
		if (this.state.time == 0) {
			this.pause();
		}
	}

	direction(data: string, x: number, y: number) {
		switch (data) {
			case "left":
				x = x - 1;
				break;
			case "right":
				x = x + 1;
				break;
			case "up":
				y = y + 1;
				break;
			case "down":
				y = y - 1;
				break;
		}
		return [x, y]
	}

	fillResources() {
		for (let item of max.keys()) {
			this.state.Resources[item] = max.get(item);
		}
	}

	//returns false if not enough Resources were available
	consume(Product: string) {
		let requirement = new Map();
		if (Product == "Coffee") { 
			requirement.set("Crema_Beans",1);
		}
		else if (Product == "Cappucchino") {
			requirement.set("Espresso_Beans",1);
			requirement.set("Milk",2);
		}
		else { return false; }
		//check if every resource is available
		for (let resource of requirement.keys()) {
			if (this.state.Resources[resource] < requirement.get(resource)) {
				return false;
			}
		}
		//consume Resources
		for (let resource of requirement.keys()) {
			this.state.Resources[resource] = this.state.Resources[resource] - requirement.get(resource);
		}
		return true;
	}

	//one type of "Use"
	Produce(client: Client, data: string, consuming: boolean = true) {
		if (this.state.players[client.sessionId].inventory != "Empty") {
			return;
		}
		if (consuming) {
			if (!this.consume(data)) {
				return;
			}
		}
		this.state.players[client.sessionId].inventory = data;
	}

	//item (desire) gets send out to the customer, assumes customer wants the item
	CustomerReceive(pos: number, desire : string) {
		let customer = this.state.customers[pos];
		this.state.customers[pos].wants[desire]--;
		if (customer.wants[desire] == 0) {
			delete this.state.customers[pos].wants[desire];
		}
		if (customer.wants.size != 0) { return; }
		if (customer.pays != 0) { 
			this.state.customers[pos].wants["Money"] = 1;
			return;
		}
		this.state.customers.splice(pos,1);
	}

	//customer gets angry when served PHP
	CustomerAngry(pos: number) {
		this.state.customers.splice(pos,1)
		this.state.score = this.state.score - 50;
	}
	
	//serving stuff to customers
	Serve(client: Client, pos: number) {
		//is there a customer at this counter
		if (this.state.customers.length <= pos) {
			return;
		}
		let inv = this.state.players[client.sessionId].inventory;
		if (inv == "PHP_Cup") { 
			this.CustomerAngry(pos);
			this.state.players[client.sessionId].inventory = "Empty";
			return;
		}
		for (let desire of this.state.customers[pos].wants.keys()) {
			//returning empty stuff
			if (desire.startsWith("Empty") || desire.endsWith("_Pfand") || desire == "Money") {
				if (this.state.players[client.sessionId].inventory != "Empty") {
					continue;
				}
				this.state.players[client.sessionId].inventory = desire;
				//transfers correct ammount of money to player
				if (desire == "Money") {
					this.state.players[client.sessionId].money_carried = this.state.customers[pos].pays;
					this.state.customers[pos].pays = 0;
				}
			} else {	//buying new stuff
				if (this.state.players[client.sessionId].inventory != desire) {
					continue;
				}
				this.state.players[client.sessionId].inventory = "Empty";
				this.state.customers[pos].pays = this.state.customers[pos].pays + 10;
			}
			this.CustomerReceive(pos,desire);
			break;
		}
	}
	
	//Refills storage of given item from player inventory
	Refill(client: Client, item : string) {
		//check if player has the right item
		if (this.state.players[client.sessionId].inventory != item) { return; }
		this.state.Resources[item] = max.get(item);
		this.state.players[client.sessionId].inventory = "Empty";
	}
	
	//this can be either getting coffee, or refilling, and handles both sides of the machine
	Machine(client: Client, side : string) {
		//both Produce and Refill methods check if the player has the valid inventory state
		if (side == "Cappucchino") {
			this.Produce(client,"Cappucchino");
			this.Refill(client,"Milk");
		}
		else {
			this.Produce(client,"Coffee");
			this.Refill(client,"Crema_Beans");
			this.Refill(client,"Espresso_Beans");
		}	
	}
	
	//returning empty bottles
	Return(client: Client, data: string) {
		let wanted = data + "_Pfand";
		if (data == "sink") {
			wanted = "Empty_Coffee_Cup";
		}
		if (this.state.players[client.sessionId].inventory != wanted) {
			return;
		}
		this.state.players[client.sessionId].inventory = "Empty";
		this.state.score = this.state.score + 10;
	}
	
	Register(client: Client) {
		if (this.state.players[client.sessionId].inventory != "Money") { return; }
		this.state.players[client.sessionId].inventory = "Empty";
		this.state.score = this.state.score + this.state.players[client.sessionId].money_carried;
		this.state.players[client.sessionId].money_carried;
	}
	
	//tries to hand item to player on coords
	HandItem(client : Client, x : number, y : number) {
		if (this.state.players[client.sessionId].inventory == "Empty") { return; }
		let otherPlayer = "";
		this.state.players.forEach((player,id) => {
			if ((player.x == x) && (player.y == y)) {
				otherPlayer = id;
				return;
			}
		});
		if (otherPlayer == "") { return; }
		if (this.state.players[otherPlayer].inventory != "Empty") { return; }
		this.state.players[otherPlayer].inventory = this.state.players[client.sessionId].inventory;
		this.state.players[client.sessionId].inventory = "Empty";
	}
	//Message Handlers	
	//delegates the "use" command to the action that is relevant for current position
	onUse(client: Client, data: any) {
		let player = this.state.players[client.sessionId];
		let pos = this.direction(player.rotation,player.x,player.y); 
		let position = pos[0]*10+pos[1];
		if (! hitbox.has(position)) {
			this.HandItem(client,pos[0],pos[1]);
			return;
		}
		let boxname = hitbox.get(position).split(" ");
		switch(boxname[0]) {
			case "counter":
				this.Serve(client,+boxname[1]);
				break;
			case "php":
				this.Produce(client, "PHP_Cup", false);
				break;
			case "return":
				this.Return(client,boxname[1]);
				break;
			case "sink":
				this.Return(client, "sink");
				break;
			case "register":
				this.Register(client);
				break;
			case "trash":
				this.state.players[client.sessionId].inventory = "Empty";
				break;
			case "machine":
				this.Machine(client,boxname[1]);
				break;
			case "wall":
			case "table":
				break; //default handles all new items from storage so this is for stuff that does nothing
			default:
				this.Produce(client, hitbox.get(position), false);
				break;
		}
	}
		
	//checks collision with any player
	playerCollision(x:number, y:number) {
	   let output = false;
	   this.state.players.forEach((player,id) => {
			if (player.x == x &&
				player.y == y) { output = true; }
		});	
		return output;
	}
	
	//move messages say the client tried to walk 1 space to given direction
	//collision check at server, update position AND rotation
	onMove(client: Client, data: any) {
		//position if the move would go through
		var x: number = this.state.players[client.sessionId].x;
		var y: number = this.state.players[client.sessionId].y;
		var rotation: string = data;
		let pos = this.direction(data, x, y);
		x = pos[0];
		y = pos[1];
		this.state.players[client.sessionId].rotation = rotation;
		//collision check
		if (x < 0 || y < 0 || x > 9 || y > 7) { return; }
		if (hitbox.has(x * 10 + y)) { return; }
		if (this.playerCollision(x, y)) { return; }
		//actually moving the player
		this.state.players[client.sessionId].x = x;
		this.state.players[client.sessionId].y = y;
	}
	
	pause() {
		clearInterval(this.gametimer);
		this.onMessage("move", (client, message) => {});
		this.onMessage("use", (client, message) => {});
		this.state.paused = true;
	}
	
	resume() {
		this.gametimer = setInterval(() => {this.gametick()}, 1000);
		this.onMessage("move", (client, message) => {
			this.onMove(client, message)
		});
		this.onMessage("use", (client, message) => {
			this.onUse(client, message)
		});
		this.state.paused = false;
	}
	
	onPause(client : Client, data : any) {
		if (client.sessionId != this.tutor) { return; }
		if (this.state.paused) { this.resume(); }
		else { this.pause(); }
	}
	
	onCreate (options: any) {
		this.setState(new State());
		this.fillResources();
		//link Message Handlers
		this.onMessage("pause", (client, message) => {
			this.onPause(client, message)
		});

		this.customerMaxId = 0;
	}

	onJoin(client: Client, options: any) {
		client.send("id", client.sessionId);
		this.state.createPlayer(client.sessionId);
		if (this.tutor == "") {
			this.tutor = client.sessionId;
			//makes tutor invisible
			this.state.players[client.sessionId].y = -4;
		}
	}

	onLeave(client: Client, consented: boolean) {
		delete this.state.players[client.sessionId]
	}

	onDispose() {
	}
	
	generateCustomer() {
		//only 7 customers fit at the counter
		if (this.state.customers.length >= 7) {
			return;
		}
		//customers spawn randomly, function is called once per second
		var random: number = Math.floor(Math.random() * 20); // numbers between 0 and 20
		if (random >= 13) {
			var order_items: string[] = ["Kolle", "Zotrine", "Premium", "Empty_Coffee_Cup", "Kolle_Pfand", "Zotrine_Pfand", "Premium_Pfand","Cappucchino","Coffee"]
			var order_item: string = ''
			var i: number;
			let wants = new MapSchema<number>();  //total ammount of items including duplicates
			var amount: number = Math.floor(Math.random() * 3) + 1; // numbers between 1 and 4
			for (i = 1; i <= amount; i++) {

				// random orderable item
				var random: number = Math.floor(Math.random() * order_items.length); 
				order_item = order_items[random]

				if (wants[order_item]) {
					wants.set(order_item,wants.get(order_item) + 1);
				} else {
					wants.set(order_item,1)
				}
			}
			this.customerMaxId = this.customerMaxId +1;
			this.state.createCustomer(wants, this.customerMaxId)
		}
	}
}
