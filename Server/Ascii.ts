import { hitbox } from "./hitbox"
import { Room, Client } from "colyseus";
import { type, Schema, MapSchema, ArraySchema } from '@colyseus/schema';
const csv = require('csv-parser')
const fs = require('fs')

var Requirements = new Map();
var max = new Map([ //needs to have exactly the entries of the csv
			["Milch",5],["Kaffeebohnen",5],["Espresso Bohnen",5],["Schokopulver",5],["Weiße Schokolade",5],
			["Kolle",3],["Premium",3],["Zotrine",3]])

//a single player
class Player extends Schema {
	@type("number") x : number = 2;	//players start behind the counter
	@type("number") y : number = 1;
	@type("string") inventory : string = "Empty";
	@type("string") rotation : string = "down";
}

class Customer extends Schema {
	@type({ map: "number" }) wants = new MapSchema<number>();
	@type("boolean") waiting : boolean = true;
	@type("number") id : number;
	@type("number") sprite_id : number;

	constructor(wants:MapSchema<number>, id:number){
		super();
		this.wants = wants;
		this.id = id;
		this.sprite_id = Math.floor(Math.random() * 1.99) + 1; // numbers between 1 and 2

	}
	
}

//state of the game in the current room
class State extends Schema {
	@type({ map: Player }) players = new MapSchema<Player>();
	@type({ map: "number" }) Resources = new MapSchema<number>();
	@type("number") score = 0;
	//function to create a new player for given id  
	createPlayer (id: string) { this.players[ id ] = new Player(); }
	@type([Customer]) customers = new ArraySchema<Customer>();
	createCustomer (wants: MapSchema<number>, id: number) { this.customers.push(new Customer(wants, id)); }
}

export class Ascii extends Room {
	customerMaxId = 0;
	//single Tick of the Timer
	gametick() {
		this.generateCustomer();
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
		if (!Requirements.has(Product)) {
			return false;
		}
		let requirement = Requirements.get(Product);
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

	CustomerReceive(pos: number, desire : string) {
		let customer = this.state.customers[pos];
		this.state.customers[pos].wants[desire]--;
		if (customer.wants[desire] == 0) {
			delete this.state.customers[pos].wants[desire];
		}
		if (Object.keys(customer.wants).length != 0) { return; }
		this.state.customers.splice(pos,1);
		this.state.score = this.state.score + 10;
	}

	//serving stuff to customers
	Serve(client: Client, pos: number) {
		let inv = this.state.players[client.sessionId].inventory;
		if (this.state.customers.length <= pos) {
			return;
		}
		//customer wants beverage
		for (let desire of (Object.keys(this.state.customers[pos].wants))) {
			//returning empty stuff
			if (desire.startsWith("Empty") || desire.endsWith("_Pfand")) {
				if (this.state.players[client.sessionId].inventory != "Empty") {
					continue;
				}
				this.state.players[client.sessionId].inventory = desire;
			} else {
				if (this.state.players[client.sessionId].inventory != desire) {
					continue;
				}
				this.state.players[client.sessionId].inventory = "Empty";
			}
			this.CustomerReceive(pos,desire);
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

	//Message Handlers	
	//delegates the "use" command to the action that is relevant for current position
	onUse(client: Client, data: any) {
		let player = this.state.players[client.sessionId];
		let pos = this.direction(player.rotation, player.x, player.y);
		let position = pos[0] * 10 + pos[1];
		if (!hitbox.has(position)) {
			return;
		}
		switch (hitbox.get(position).split(" ")[0]) {
			case "counter":
				this.Serve(client, +hitbox.get(position).split(" ")[1]);
				break;
			case "php":
				this.Produce(client, "PHP_Cup", false);
				break;
			case "return":
				this.Return(client, hitbox.get(position).split(" ")[1]);
				break;
			case "sink":
				this.Return(client, "sink");
				break;
			case "trash":
				this.state.players[client.sessionId].inventory = "Empty";
				break;
			case "wall":
			case "table":
				break; //default handles all new items from storage so this is for stuff that does nothing
			//this handles all getting new stuff from storage
			default:
				this.Produce(client, hitbox.get(position), false);
				break;
		}
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
		if (x < 0 || y < 0 || x > 9 || y > 7) {
			return;
		}
		if (hitbox.has(x * 10 + y)) {
			return;
		}
		//actually moving the player
		this.state.players[client.sessionId].x = x;
		this.state.players[client.sessionId].y = y;
	}

	onRefill(client: Client, data: any) {
		if (data == "all") {
			this.fillResources();
			return;
		}
		if (!max.has(data)) {
			return;
		}
		this.state.Resources[data] = max.get(data);
	}

	startup() {
		this.fillResources();
		//link Message Handlers
		this.onMessage("move", (client, message) => {
			this.onMove(client, message)
		});
		this.onMessage("use", (client, message) => {
			this.onUse(client, message)
		});
		this.onMessage("refill", (client, message) => {
			this.onRefill(client, message)
		});
		//start game timer, number is intervall in milliseconds
		setInterval(() => {
			this.gametick()
		}, 1500);

		this.customerMaxId = 0;
	}

	onCreate(options: any) {
		//read file
		fs.createReadStream('Resources.csv')
			.pipe(csv())
			.on('data', (data: any) => {
				let name: string = data["Getränk"]
				let req = new Map();
				for (let resource of Object.keys(data)) {
					if (data[resource] == '' || resource == "Getränk") {
						continue;
					}
					req.set(resource, parseInt(data[resource]));
				}
				Requirements.set(name, req);
			}).on('end', () => {
			this.startup();
		});
		this.setState(new State());

		this.onMessage("*", (client, essage) => {
			console.log("Server isnt finished yet");
		});
	}

	onJoin(client: Client, options: any) {
		client.send("id", client.sessionId);
		this.state.createPlayer(client.sessionId);
	}

	onLeave(client: Client, consented: boolean) {
		delete this.state.players[client.sessionId]
	}

	onDispose() {
	}

	generateCustomer() {
		if (this.state.customers.length >= 7) {
			return;
		}
		var random: number = Math.floor(Math.random() * 20); // numbers between 0 and 10
		if (random >= 13) {
			//var order_items: string[] = ["Kolle", "Zotrine", "Premium", "Empty_Coffee_Cup", "Kolle_Pfand", "Zotrine_Pfand", "Premium_Pfand"]
			var order_items: string[] = ["Kolle", "Zotrine", "Premium"]

			var order_item: string = ''
			var i: number;
			let wants = new MapSchema<number>();
			var amount: number = Math.floor(Math.random() * 3) + 1; // numbers between 1 and 4
			for (i = 1; i <= 1; i++) {

				var random: number = Math.floor(Math.random() * order_items.length); // numbers between 0 and 3
				order_item = order_items[random]

				if (wants[order_item]) {
					wants[order_item] = wants[order_item] + 1;
				} else {
					wants[order_item] = 1
				}
			}
			this.customerMaxId = this.customerMaxId +1;

			this.state.createCustomer(wants, this.customerMaxId)
		}
	}
}
