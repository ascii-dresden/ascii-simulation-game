//exports the map from coordinate to hitbox type
var hitbox = new Map([ 
[27,"register"],													//put money        -> get score
[57,"return zotrine"],[67,"return premium"],[77,"return kolle"],   	//put empty bottle -> get score
//cup return where exactly?
[96,"Zotrine"],[95,"Premium"],[94,"Kolle"],							//get full bottle
[92,"sink"],[91,"sink"],											//just hitbox as of now
[55,"milk"],[54,"espresso"],[53,"crema"],							//get refill stuff for coffee machine
[52,"fridge"],														//just hitbox as of now
[32,"machine coffee"],[33,"machine milk"],							//coffee machine sides differ for refill
[31,"php"],															//php gives hard penalties when served to any customer
[70,"trash"],														//trashcan allows to empty inventory
[37,"table"],[93,"table"],[90,"table"]								//hitboxes with no specific meaning
])


//counters 0-6, allow serving customer at that counter
for (let i = 0; i < 7; i++) { hitbox.set(10+i,"counter " + i.toString()); }
//just a wall
for (let i = 1; i < 7; i++) { hitbox.set(40+i,"wall"); }

export { hitbox };
