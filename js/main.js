//NOTE: player sprint speed is in ft/s

let margin = {top: 40, right: 10, bottom: 60, left: 60};

let width = 600 - margin.left - margin.right,
    height = 600 - margin.top - margin.bottom;

//Separate field dimensions without margins
let fielddim = 500;

//Set player and ball icon radii
let playerRad = 5
let ballRad = 2.5

//Set maximum batter exit velo; default is 120 mph
let maxExitVeloMPH = 120
let maxExitVelofps = maxExitVeloMPH * 1.46667
//Set minimum batter exit velo; default is 60 mph
let minExitVeloMPH = 60
let minExitVelofps = minExitVeloMPH * 1.46667
//Set average batter exit angle; default is 30 degrees
let exitAngleDeg = 30
let exitAngleRad = exitAngleDeg / 180 * Math.PI
//Set player reaction time; default is 0.2 sec for infield and 0.5 sec for outfield
let rtimeInfield = 0.2
let rtimeOutfield = 0.5

//Set who is in the outfield
let outfield = ["LF","CF","RF"]

//Distance of the foul line to the fence from homeplate, in feet
// (i.e. home plate to left field wall, along the foul line)
let outfieldFoulFenceDistance = 325
// Calculate x and y components of the foul line
const oFFDy = Math.cos(Math.PI/4) * outfieldFoulFenceDistance

//Distance between bases (e.g. home to first)
let baseDistance = 90
// Calculate x and y components of the distance
const bDy = Math.cos(Math.PI/4) * baseDistance

let yfieldLineScale = d3.scaleLinear()
    .domain([0,oFFDy])
    .range([450,200])

let xfieldLineScale = d3.scaleLinear()
    .domain([-oFFDy,oFFDy])
    .range([-250,250])

//Initialize global variables
var players;
var field;
var ball;
var landings;
var ballpos = [];
var csvData;
var traveltimeglobal;

//Initialization functions
drawField();
drawPlayers("data/players.csv");

//Button presses
// Activates to generate random ball position
document.getElementById("ball-gen").onclick = genBall
// Activates to calculate and plot time to intercept
document.getElementById("ball-gen-100").onclick = genBall100


function drawField(){
    field = d3.select("#field").append("svg")
        .attr("id","field-svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    field.append("path")
        .attr("id","fieldline")
        .attr("stroke","black")
        .attr("fill","white")
        .attr('pointer-events', 'all')
        .attr("d","M 250 450 L " +
            (fielddim/2 + xfieldLineScale(-oFFDy)) + " " + yfieldLineScale(oFFDy) +
            " Q 100 50 250 50 Q 400 50 " +
            (xfieldLineScale(oFFDy) + fielddim/2) + " " + yfieldLineScale(oFFDy) +
            " Z");

    field.append("path")
        .attr("id","infield")
        .attr("stroke","black")
        .attr("fill","white")
        .attr("d","M 250 450 L " +
            (fielddim/2 + xfieldLineScale(-bDy)) + " " + yfieldLineScale(bDy) +
            " L " + (fielddim/2) + " " + (yfieldLineScale(2 * bDy)) + " L " +
            (xfieldLineScale(bDy) + fielddim/2) + " " + yfieldLineScale(bDy) +
            " Z");

}

function drawPlayers(inputPlayers){
    //Loading player CSV
    d3.csv(inputPlayers, (row) => {
        row.number = +row.number;
        row.speed = +row.speed;
        row.skill = +row.skill;
        return row;
    })
        .then(data => {
            csvData = data;
            // Define player group
            players = d3.select("#field").select("svg")
                .append("g")
                .attr("id","players")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

            // Draw players
            players.selectAll("circle")
                .data(data)
                .enter()
                .append("circle")
                .attr("class","player")
                .attr("id",d => d.position)
                .attr("r",playerRad)
                .attr("cx",d => {
                    return xfieldLineScale(positionSVGCoords(d.position,"x")) + fielddim/2
                })
                .attr("cy",d => {
                    return yfieldLineScale(positionSVGCoords(d.position,"y"))
                })
                .attr("fill","blue")

            // Define individual drag functionalities
            let drag = d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended);

            //Add drag capabilities to players
            players.selectAll('circle')
                .call(drag);

            //Initialize the ball
            ball = d3.select("#field").select("svg")
                .append("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
                .append("circle")
                .attr("id","ball")
                .attr("cx", xfieldLineScale(0) + fielddim/2)
                .attr("cy", yfieldLineScale(0))
                .attr("r",ballRad)
                .attr("fill","red")
                .attr("fill-opacity",0);

            //Initialize simulated hit recorder
            landings = d3.select("#field").select("svg")
                .append("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        })
}

function dragstarted(d) {
    //d3.select(self).raise().classed('active', true);
}

// Move players when dragged
function dragged(event) {
    console.log(event.x)
    let tempx = xfieldLineScale.invert(event.x - fielddim/2);
    let tempy = yfieldLineScale.invert(event.y);
    d3.select(this)
        .attr('cx', xfieldLineScale(tempx) + fielddim/2)
        .attr('cy', yfieldLineScale(tempy))
}

function dragended(d) {
    //d3.select(this).classed('active', false);
}

//Function to randomly generate a ball location on the field
function genBall(){

    var tempx;
    var tempy;

    // Fetch the boundaries of the field and initialize an SVG point
    let path = document.getElementById('fieldline');
    let testpoint = document.getElementById('field-svg').createSVGPoint();

    do {
        // Generate a random x and y value for the ball
        tempx = Math.random() * height
        tempy = Math.random() * height

        // This code chunk tests if the hit ball is inside the park
        testpoint.x = tempx
        testpoint.y = tempy
        console.log(testpoint.x, testpoint.y)
        console.log('Point at 30,30:', path.isPointInFill(testpoint));
    }
    while (!(path.isPointInFill(testpoint)))

    //Plot the ball in the field
    d3.select("#ball")
        .transition()
        .duration(250)
        .attr("cx",xfieldLineScale(0) + fielddim/2)
        .attr("cy",yfieldLineScale(0))
        .transition()
        .attr("fill-opacity",100)
        .attr("cx",tempx)
        .attr("cy",tempy)

    //set global ball position variable
    ballpos = [tempx,tempy]

    traveltimeglobal = calculateTravelTime();
    calculateTimeToIntercept();
}

function genBall100(){
    for (var i = 0; i < 100; i++){
        var tempx;
        var tempy;

        // Fetch the boundaries of the field and initialize an SVG point
        let path = document.getElementById('fieldline');
        let testpoint = document.getElementById('field-svg').createSVGPoint();

        do {
            // Generate a random x and y value for the ball
            tempx = Math.random() * height
            tempy = Math.random() * height

            // This code chunk tests if the hit ball is inside the park
            testpoint.x = tempx
            testpoint.y = tempy
            console.log(testpoint.x, testpoint.y)
            console.log('Point at 30,30:', path.isPointInFill(testpoint));
        }
        while (!(path.isPointInFill(testpoint)))

        //set global ball position variable
        ballpos = [tempx,tempy]

        traveltimeglobal = calculateTravelTime();
        calculateTimeToIntercept();
    }

}

//This function calculates the travel time of the baseball using a random exit velocity
function calculateTravelTime(){
    var tempv = Math.random() * (maxExitVelofps - minExitVelofps) + minExitVelofps
    console.log("Tempv: " + tempv)
    var tempxv = tempv * Math.cos(exitAngleRad)
    console.log("Tempxv: " + tempxv)
    var fieldx = xfieldLineScale.invert(ballpos[0] - fielddim/2);
    var fieldy = yfieldLineScale.invert(ballpos[1]);

    console.log("fieldx and fieldy:" + fieldx, fieldy)

    var distance = distancecalc(fieldx,fieldy,0,0);
    var traveltime = distance / tempxv;

    console.log("Travel Time: " + traveltime)
    return traveltime
}

function distancecalc(x1, y1, x2, y2){
    return Math.sqrt(Math.pow(x2 - x1,2) + Math.pow(y2 - y1,2));
}

function calculateTimeToIntercept(){
    // Store the player position closest to the ball and the time to intercept
    var mintime = [null,0]
    console.log(csvData)
    var tempx;
    var tempy;
    var temptti;
    d3.selectAll(".player").each(function(d,i) {
        tempx = d3.select(this).attr("cx")
        tempy = d3.select(this).attr("cy")
        temptti = distancecalc(
            xfieldLineScale.invert(ballpos[0] - fielddim/2),
            yfieldLineScale.invert(ballpos[1]),
            xfieldLineScale.invert(tempx - fielddim/2),
            yfieldLineScale.invert(tempy)) / csvData[i].speed

        if (outfield.includes(d3.select(this).attr("id"))){
            temptti += rtimeOutfield
        }
        else {
            temptti += rtimeInfield
        }

        if (i === 0 || temptti < mintime[1]){
            mintime = [d3.select(this).attr("id"),temptti]
        }
    })
    console.log(mintime)
    if (mintime[1] < traveltimeglobal){
        landings.append("circle")
            .attr("class","record fielded")
            .attr("fill","green")
            .attr("cx",ballpos[0])
            .attr("cy",ballpos[1])
            .attr("r",2)
    }
    else {
        landings.append("rect")
            .attr("class","record not-fielded")
            .attr("fill","red")
            .attr("x",ballpos[0]-2)
            .attr("y",ballpos[1]-2)
            .attr("width",4)
            .attr("height",4)
    }
    /*
    for (var i = 0; i < csvData.length; i++){
        console.log("Checking " + csvData[i].firstname + csvData[i].lastname + "...")

    }

     */
}

// Input: Field position of player (e.g. 3B, SS)
// Output: x or y SVG coordinate of the player on the pitch
function positionSVGCoords(position,dimension){
    if (dimension === "x"){
        if (position === "P") {return 0}
        else if (position === "C") {return 0}
        else if (position === "1B") {return 55}
        else if (position === "2B") {return 10}
        else if (position === "3B") {return -55}
        else if (position === "SS") {return -25}
        else if (position === "RF") {return 150}
        else if (position === "LF") {return -150}
        else if (position === "CF") {return 0}

        else {return 50;}
    }
    else {
        if (position === "P") {return 60.5;}
        else if (position === "C") {return 0}
        else if (position === "1B") {return 65}
        else if (position === "2B") {return 120}
        else if (position === "3B") {return 95}
        else if (position === "SS") {return 120}
        else if (position === "RF") {return 225}
        else if (position === "LF") {return 225}
        else if (position === "CF") {return 300}
        else {return 0;}
    }

}