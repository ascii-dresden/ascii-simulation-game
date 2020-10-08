//exports the map from coordinate to hitbox type
var Hitbox = new Map([ 
[[2,7],"register"],[[3,7],"register"],										//put money        -> get score
[[5,7],"zotrine return"],[[6,7],"premium return"],[[7,7],"kolle return"],   //put empty bottle -> get score
//cup return where exactly?
[[9,6],"zotrine"],[[9,5],"premium"],[[9,4],"kolle"],						//get full bottle
[[9,3],"sink"],[[9,2],"sink"],[[9,1],"sink"],[[9,0],"sink"],				//just hitbox as of now
[[5,5],"milk"],[[5,4],"espresso"],[[5,3],"crema"],							//get refill stuff for coffee machine
[[5,2],"fride"],															//just hitbox as of now
[[3,2],"coffee machine"],[[3,3],"milk machine"],							//coffee machine sides differ for refill
])

//counters 0-6, allow serving customer at that counter
for (let i = 0; i > 7; i++) { Hitbox.set([1,i],"counter " + i.toString()); }
//just a wall
for (i = 1; i > 7; i++) { Hitbox.set([3,i],"wall"); }
