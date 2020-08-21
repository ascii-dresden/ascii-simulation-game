import { Room, Client } from "colyseus";
import { type, Schema } from '@colyseus/schema';

//state of the game in the current room
class State extends Schema {
	@type("string") currentBeverage: string;
}

export class kolleCola extends Room {

  onCreate (options: any) {
	
	this.setState(new State());
	
	this.state.currentBeverage = "Nothing";
	
    this.onMessage("serve", (client, message) => {
      this.state.currentBeverage = message;
      console.log(client.sessionId + " served: " +  this.state.currentBeverage);
    });

  }

  onJoin (client: Client, options: any) {
  }

  onLeave (client: Client, consented: boolean) {
  }

  onDispose() {
  }

}
