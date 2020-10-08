//NOTE: player sprint speed is in ft/s

let margin = {top: 40, right: 10, bottom: 60, left: 60};

let width = 600 - margin.left - margin.right,
    height = 600 - margin.top - margin.bottom;

//Separate field dimensions without margins
let fielddim = 500;

//Set player and ball icon radii
let playerRad = 5
let ballRad = 2.5

//Gravity
const gravity = -32.17

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

//Set tooltip box height and width
var tooltipheight = 20
var tooltipwidth = 100

//Initialize global variables
var players;
var field;
var ball;
var landings;
var ballpos = [];
var csvData;
var traveltimeglobal;
var landingData = [];
var Tooltip;

//Initialization functions
drawField();
drawPlayers("data/players.csv");

//Button presses
// Activates to generate random ball position
document.getElementById("ball-gen").onclick = betterGenBall
// Activates to calculate and plot time to intercept
document.getElementById("ball-gen-100").onclick = betterGenBall100
document.getElementById("clear-landings").onclick = clearLandings
document.getElementById("reset-players").onclick = resetPlayers

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
        function cleanPosition(input){
            if (input === "1B") {
                return "OneB"
            } else if (input === "2B") {
                return "TwoB"
            } else if (input === "3B") {
                return "ThreeB"
            } else {
                return input
            }
        }
        row.position = cleanPosition(row.position);
        return row;
    })
        .then(data => {
            console.log(data)
            csvData = data;

            //Initialize simulated hit recorder
            //This comes first because the players need to be above the hits
            landings = d3.select("#field").select("svg")
                .append("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

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
                .attr("id","ball-group")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
                .append("circle")
                .attr("id","ball")
                .attr("cx", xfieldLineScale(0) + fielddim/2)
                .attr("cy", yfieldLineScale(0))
                .attr("r",ballRad)
                .attr("fill","red")
                .attr("fill-opacity",0);

            //Initialize tooltips
            Tooltip = d3.select("#field")
                .select("svg")
                .append("g")
                .attr("id","tooltip-group");

            Tooltip.append("rect")
                .attr("class", "tooltip-custom")
                .attr("fill","white")
                .attr("fill-opacity",0)
                .attr("stroke-opacity",0)
                .attr("stroke","black")
                .attr("stroke-width",1)
                .attr("height",0)
                .attr("width",0)
                .attr("x",0)
                .attr("y",0)

            Tooltip.append("text")
                .attr("class","tooltip-text")
                .attr("fill","black")
                .attr("x",10)
                .attr("y",10)

        })
}

function resetPlayers(){
    players.selectAll("circle")
        /*
        .data(csvData)
        .enter()
        .append("circle")
        .attr("class","player")
        .attr("id",d => d.position)
         */
        .transition()
        .attr("cx",d => {
            return xfieldLineScale(positionSVGCoords(d.position,"x")) + fielddim/2
        })
        .attr("cy",d => {
            return yfieldLineScale(positionSVGCoords(d.position,"y"))
        })
}

function dragstarted(d,i) {
    d3.selectAll("#" + i.position)
        .transition()
        .ease(d3.easeCubicInOut)
        .attr("r",playerRad*2)
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

function dragended(d,i) {
    d3.selectAll("#" + i.position)
        .transition()
        .ease(d3.easeCubicInOut)
        .attr("r",playerRad)
    //d3.select(this).classed('active', false);
}

function betterGenBall100() {

    for (var i = 0; i < 100; i++){
        var tempcoords;
        var traveltime;
        var yvelo;
        var launchangle;
        var exitvelo;

        // Fetch the boundaries of the field and initialize an SVG point
        let path = document.getElementById('fieldline');
        let testpoint = document.getElementById('field-svg').createSVGPoint();

        do {
            // Generate a random angle (left field = 0 deg, right field = 90 deg) for the ball
            var tempangle = Math.random() * Math.PI / 2 + (Math.PI / 4)

            //Generate a random launch angle and velocity, preferring fly balls between 30-90 deg
            /*
            From the MLB: Launch Angles:
                Ground ball: Less than 10 degrees
                Line drive: 10-25 degrees
                Fly ball: 25-50 degrees
                Pop up: Greater than 50 degrees

            Default league average launch angle is set at 10 degrees
            Assume that all hits follow a normal distribution around 10 degrees,
            with a maximum launch angle of 80 degrees
             */

            // Keep calculating launch angles until we get a fly ball
            do {
                launchangle = d3.randomNormal(10,70/3)()
            }
            while (launchangle < 25)

            //Generate a random exit velo (from a Gaussian distribution)
            //League average exit velo is about 89MPH, and max exit velo is around 120
            //Therefore, standard deviation is approximately 31/3
            exitVelo = d3.randomNormal([89],[10.33])()
            //exitVelo = randomNormal(4) * (120 - 58) + 58
            //convert to feet per second
            exitVelo *= 1.46667

            var xvelo = Math.cos(launchangle * Math.PI / 180) * exitVelo
            yvelo = Math.sin(launchangle * Math.PI / 180) * exitVelo

            // Calculate traveltime using d = vi*t + 0.5(a)t^2
            //                            t = (d - 0.5(a)t^2)/vi
            // Assume contact height from 1.5 ft to 3.5 ft
            // Acceleration due to gravity is -32.17 ft/s^2

            var contactheight = d3.randomNormal(2.5,1/3)()
            var traveltimearray = quadraticFormula(0.5 * gravity, yvelo, -contactheight)

            if (traveltimearray[0] === 0) {
                traveltime = null
            } else if (traveltimearray[0] === 1) {
                traveltime = traveltimearray[1]
            } else {
                traveltime = Math.max(traveltimearray[1], traveltimearray[2])
            }

            var distance = xvelo * traveltime;

            tempcoords = components(distance, tempangle)

            /////////Currently calculating distance, then break into components to get coordinates

            // This code chunk tests if the hit ball is inside the park
            testpoint.x = xfieldLineScale(tempcoords[0]) + fielddim / 2
            testpoint.y = yfieldLineScale(tempcoords[1])
        }
        while (!(path.isPointInFill(testpoint)))

        var svgcoords = [xfieldLineScale(tempcoords[0]) + fielddim / 2, yfieldLineScale(tempcoords[1])]

        //set global ball position variable
        ballpos = [svgcoords[0], svgcoords[1]]

        traveltimeglobal = traveltime;
        calculateTimeToIntercept(launchangle, exitvelo);
    }
    filterByHit()
}

function betterGenBall() {
    var tempcoords;
    var traveltime;
    var yvelo;
    var launchangle;
    var exitvelo;
    var grounderdata = [];
    var forceFlyBall = false;

    // Fetch the boundaries of the field and initialize an SVG point
    let path = document.getElementById('fieldline');
    let testpoint = document.getElementById('field-svg').createSVGPoint();

    // Generate a random angle (left field = 0 deg, right field = 90 deg) for the ball
    var tempangle = Math.random() * Math.PI/2 + (Math.PI/4)

    do {


        //Generate a random launch angle and velocity, preferring fly balls between 30-90 deg
        /*
        From the MLB: Launch Angles:
            Ground ball: Less than 10 degrees
            Line drive: 10-25 degrees
            Fly ball: 25-50 degrees
            Pop up: Greater than 50 degrees

        Default league average launch angle is set at 10 degrees
        Assume that all hits follow a normal distribution around 10 degrees,
        with a maximum launch angle of 80 degrees
         */
        // Keep calculating launch angles until we get a fly ball or ground ball (aka not a line drive)
        var approved;

        do {
            launchangle = d3.randomNormal(10,70/3)()

            if (forceFlyBall){
                approved = (launchangle < 25)
            }
            else{
                approved = (launchangle < 25 && launchangle >= 10)
            }

        }
        while (approved)

        //Since we check for "inside the park" differently, this allows us to actually
        //maintain an even distribution of fly balls and grounders
        if (launchangle >= 25){
            forceFlyBall = true;
        }

        console.log("Launch Angle: " + launchangle)

        //Generate a random exit velo (from a Gaussian distribution)
        //League average exit velo is about 89MPH, and max exit velo is around 120
        exitVelo = d3.randomNormal([89],[10.33])()
        //convert to feet per second
        exitVelo *= 1.46667

        var xvelo = Math.cos(launchangle * Math.PI/180) * exitVelo
        yvelo = Math.sin(launchangle * Math.PI/180) * exitVelo

        // Calculate traveltime using d = vi*t + 0.5(a)t^2
        //                            t = (d - 0.5(a)t^2)/vi
        // Assume contact height from 1.5 ft to 3.5 ft
        // Acceleration due to gravity is -32.17 ft/s^2

        var contactheight = d3.randomNormal(2.5,1/3)()

        // Calculate intercept point for ground ball (if any)
        //
        if (launchangle < 10 && !forceFlyBall){
            grounderdata = groundBallTTI(tempangle,xvelo,launchangle,exitVelo);
            break;
        }



        var traveltimearray = quadraticFormula(0.5*gravity,yvelo,-contactheight)

        if (traveltimearray[0] === 0){
            traveltime = null
        }
        else if (traveltimearray[0] === 1){
            traveltime = traveltimearray[1]
        }
        else {
            traveltime = Math.max(traveltimearray[1],traveltimearray[2])
        }

        var distance = xvelo * traveltime;

        tempcoords = components(distance,tempangle)

        /////////Currently calculating distance, then break into components to get coordinates

        // This code chunk tests if the hit ball is inside the park
        testpoint.x = xfieldLineScale(tempcoords[0]) + fielddim/2
        testpoint.y = yfieldLineScale(tempcoords[1])
        console.log(testpoint.x, testpoint.y)
        console.log('Point test:', path.isPointInFill(testpoint));
    }
    while (!(path.isPointInFill(testpoint)))

    console.log("Grounder data's length is " + grounderdata.length)

    if (grounderdata.length != 0){
        //grounderdata's format: svg xposition, svg yposition, time to intercept, boolean fielded?
        ballpos = [grounderdata[0],grounderdata[1]]
        traveltimeglobal = grounderdata[2]
        var caught = grounderdata[3]

        filterByHit()

        d3.select("#ball")
            .transition()
            .duration(250)
            .attr("fill",function(){
                if (caught){return "green"}
                else {return "red"}
            })
            .attr("cx",xfieldLineScale(0) + fielddim/2)
            .attr("cy",yfieldLineScale(0))
            .transition()
            .duration(traveltimeglobal * 1000)
            .attr("fill-opacity",100)
            .attr("cx",ballpos[0])
            .attr("cy",ballpos[1])
            .attr("r",ballRad)
    }
    else{
        var svgcoords = [xfieldLineScale(tempcoords[0]) + fielddim/2,yfieldLineScale(tempcoords[1])]
        var halfsvgcoords = [xfieldLineScale(tempcoords[0]/2) + fielddim/2,yfieldLineScale(tempcoords[1]/2)]

        //Create scale for ball size based on height
        //calculate max height reached using d = vi^2/(-2a)
        ballheight = Math.pow(yvelo,2)/(-2*gravity)
        //Maximum possible height given a 90-degree angle and 120mph exit velo is approx. 1579
        let ballScale = d3.scaleLinear()
            .domain([0,1579])
            .range([5,15]);

        //set global ball position variable
        ballpos = [svgcoords[0],svgcoords[1]]

        traveltimeglobal = traveltime;

        var caught = calculateTimeToIntercept(launchangle,exitvelo);

        //Edit opacity depending on the type of ball
        filterByHit()

        //Plot the ball in the field
        d3.select("#ball")
            .transition()
            .duration(250)
            .attr("fill",function(){
                if (caught){return "green"}
                else {return "red"}
            })
            .attr("cx",xfieldLineScale(0) + fielddim/2)
            .attr("cy",yfieldLineScale(0))
            .transition()
            .ease(d3.easeLinear)
            .duration(traveltime * 500)
            .attr("fill-opacity",100)
            .attr("cx",halfsvgcoords[0])
            .attr("cy",halfsvgcoords[1])
            .attr("r",ballScale(ballheight))
            .transition()
            .ease(d3.easeLinear)
            .duration(traveltime * 500)
            .attr("cx",svgcoords[0])
            .attr("cy",svgcoords[1])
            .attr("r",ballRad)
    }



}

//Calculate timetointercept for a ground ball
/*
acceleration = 0.5 * g (coefficient of friction times gravity)

We assume that ground balls hit the ground immediately and start decelerating at deltaT seconds after contact. After
every deltaT seconds, we calculate the location of the ball and check if it's hit its maximum roll distance.
Find the position of the closest player and calculate the time to intercept (including reaction time) to arrive at the
ball's current position.

maxdistancetime = v0/(a)
maxdistance = v0^2/2(a)
maxdistancecomponents = components(maxdistance,tempangle)
tempx = 0
tempy = 0
calculate x component of velocity
calculate y component of velocity
var mintime = [null,0]

do {
    elapsed time += deltaT
    tempx += xvelocity * deltaT
    tempy += yvelocity * deltaT
    if elapsed time > maxdistancetime {
        elapsed time = maxdistancetime
        tempx = maxdistancecomponents[0]
        tempy = maxdistancecomponents[1]
    }


    mintime = tti(tempx,tempy)


}
while (ball is not at maximum roll distance AND time to intercept the ball is greater than elapsed time since contact)
aka while (elapsed time < maxdistancetime && elapsed time < mintime[1])

Record the x and y coordinates of the interception (tempx and tempy)
Calculate amount of time to throw the ball to first
Sum: mintime[1], ball transfer time, throw-to-first time
If an out can be made:
    Plot the x and y coordinates of the ball in green
    Tag this ball with the player who made the out
    Plot a line from home plate to the ball in transparent green
    Return the x and y coordinates of the ball and the time since contact
If an out cannot be made:
    Plot the x and y coordinates of the ball in red
    Tag this ball with the player who was closest to the out
    Plot a line from home plate to the ball in transparent red
    Return the x and y coordinates of the ball and the time since contact

 */
function groundBallTTI(tempangle,xvelo,launchangle,exitvelo){
    //Inputs:
    // tempangle: directional angle (left vs. right field) in radians
    // xvelo: x component of exit velocity, in ft/s
    console.log("---------------")
    console.log("GROUND BALL")
    let path = document.getElementById('fieldline');
    let testpoint = document.getElementById('field-svg').createSVGPoint()

    //Setting time step, default 0.1
    var deltaT = 0.1

    //Setting ball coefficient of friction, default 0.5
    const ballfric = 0.5
    const ballacc = -ballfric*gravity

    //Calculate time until maximum rolling distance is achieved (when the ball stops rolling)
    var maxdistancetime = xvelo / ballacc
    //Calculate maximum rolling distance of the ball (when friction stops it from rolling further)
    var maxdistance = Math.pow(xvelo,2)/(2*ballacc)
    var maxdistancecomponents = components(maxdistance,tempangle)
    var xvelocomponents = components(xvelo,tempangle)
    var tempx = 0
    var tempy = 0
    var mintime = [null,0]
    var elapsedtime = 0;
    var stepx = 0;
    var stepy = 0;

    console.log("Max Distance Time: " + maxdistancetime)
    console.log("Max Distance: " + maxdistance)
    console.log("tempangle: " + (tempangle*180/Math.PI))

    do {
        //Step the distances one forwards and check if we've exited the stadium
        stepx += xvelocomponents[0] * deltaT;
        stepy += xvelocomponents[1] * deltaT;
        testpoint.x = xfieldLineScale(stepx) + fielddim/2
        testpoint.y = yfieldLineScale(stepy)
        if (!(path.isPointInFill(testpoint))){
            console.log("HIT THE WALL =====================")
            break;
        }

        //Update elapsed time and the current coordinates
        elapsedtime += deltaT;
        tempx = stepx;
        tempy = stepy;

        //Adjust if we've reached maximum distance
        if (elapsedtime > maxdistancetime) {
            elapsedtime = maxdistancetime;
            tempx = maxdistancecomponents[0];
            tempy = maxdistancecomponents[1];
        }

        //Calculate which player is closest to the ball
        mintime = tti(xfieldLineScale(tempx) + fielddim/2, yfieldLineScale(tempy))
        console.log("Time: " + elapsedtime)
        console.log("Position: " + tempx + ", " + tempy)
        console.log("mintime" + mintime[0] + " " + mintime[1])
    }
    while (elapsedtime < maxdistancetime && elapsedtime < mintime[1])

    console.log(tempx,tempy)
    var timetofirst = throwtofirst(mintime[0],tempx,tempy)

    //set ball transfer time from fielding the ball to throwing (release time)
    var transfertime = 0.2

    //set time for runner from home to 1st; default to MLB average of 4.25s (4.3 righty, 4.2 lefty)
    var runnertime = 4.25

    //Calculate total time from contact to the ball arriving at first
    var totaltime = mintime[1] + transfertime + timetofirst

    console.log("33333333333333333333")
    console.log("TTI: " + mintime[1])
    console.log("timetofirst: " + timetofirst)
    console.log("Total time: " + totaltime)
    var hittype = "Ground Ball"
    if (totaltime < runnertime){
        console.log("A play has been made!")

        landingData.push({
            type: hittype,
            xpos: (xfieldLineScale(tempx) + fielddim/2),
            ypos: yfieldLineScale(tempy),
            launchangle: launchangle,
            exitvelo: exitvelo,
            traveltime: mintime[1],
            fielded: true,
            closestplayer: mintime[0]
        })

        landings.selectAll("line.ground-ball.fielded")
            .data(landingData.filter(function(d) { return (d.fielded && d.type === "Ground Ball"); }))
            .enter()
            .append("line")
            .attr("class","record fielded line " + hyphenate(hittype))
            .attr("x1",xfieldLineScale(0) + fielddim/2)
            .attr("y1",yfieldLineScale(0))
            .attr("x2",d=>d.xpos)
            .attr("y2",d=>d.ypos)
            .attr("stroke","#90ee90")
            .attr("stroke-opacity",1)

        landings.selectAll("circle.ground-ball.fielded")
            .data(landingData.filter(function(d) { return (d.fielded && d.type === "Ground Ball"); }))
            .enter()
            .append("circle")
            .attr("class","record fielded " + hyphenate(hittype))
            .attr("fill","green")
            .attr("cx",d=>d.xpos)
            .attr("cy",d=>d.ypos)
            .attr("fill-opacity",1)
            .attr("r",2)
            .on("mouseover", function(mouse,data) {
                Tooltip.select(".tooltip-custom")
                    .attr("x",mouse.offsetX + 8)
                    .attr("y",mouse.offsetY - tooltipheight - 5)
                    .attr("height",tooltipheight)
                    .attr("width",tooltipwidth)
                    .transition()
                    .duration(150)
                    .attr("fill-opacity",1)
                    .attr("stroke-opacity",1);

                Tooltip.select(".tooltip-text")
                    .attr("x",mouse.offsetX + 10)
                    .attr("y",mouse.offsetY - 10)
                    .text(data.type + ": " + d3.format(".1f")(data.traveltime) + "s.")
                    .transition()
                    .duration(150)
                    .attr("fill-opacity",1)


                console.log(data)
                console.log(mouse)
                d3.select(this)
                    .transition()
                    .duration(150)
                    .attr("stroke", "black")
                    .attr("r",5)
                    .attr("x",d=>(d.xpos-4))
                    .attr("y",d=>(d.ypos-4))
                    .attr("width",8)
                    .attr("height",8)
            })
            .on("mouseleave", function(d) {
                Tooltip.select(".tooltip-custom")
                    .transition()
                    .duration(150)
                    .attr("fill-opacity",0)
                    .attr("stroke-opacity",0)
                    .transition()
                    .duration(0)
                    .attr("height",0)
                    .attr("width",0);

                Tooltip.select(".tooltip-text")
                    .transition()
                    .duration(150)
                    .attr("fill-opacity",0)
                    .transition()
                    .duration(0)
                    .text("")
                d3.select(this)
                    .transition()
                    .duration(150)
                    .attr("stroke", "none")
                    .attr("r",2)
                    .attr("x",d=>(d.xpos-2))
                    .attr("y",d=>(d.ypos-2))
                    .attr("width",4)
                    .attr("height",4)
            })

        //Return: svg xposition, svg yposition, time to intercept, boolean fielded?
        return [(xfieldLineScale(tempx) + fielddim/2),yfieldLineScale(tempy),mintime[1],true]
    }
    else {
        console.log("The runner is safe...")

        landingData.push({
            type: hittype,
            xpos: (xfieldLineScale(tempx) + fielddim/2),
            ypos: yfieldLineScale(tempy),
            launchangle: launchangle,
            exitvelo: exitvelo,
            traveltime: mintime[1],
            fielded: false,
            closestplayer: mintime[0]
        })

        landings.selectAll("line.ground-ball.not-fielded")
            .data(landingData.filter(function(d) { return (!d.fielded && d.type === "Ground Ball"); }))
            .enter()
            .append("line")
            .attr("class","record not-fielded line " + hyphenate(hittype))
            .attr("x1",xfieldLineScale(0) + fielddim/2)
            .attr("y1",yfieldLineScale(0))
            .attr("x2",d=>d.xpos)
            .attr("y2",d=>d.ypos)
            .attr("stroke","#ffcccb")
            .attr("stroke-opacity",1)

        landings.selectAll("circle.ground-ball.not-fielded")
            .data(landingData.filter(function(d) { return ((!d.fielded) && d.type === "Ground Ball"); }))
            .enter()
            .append("circle")
            .attr("class","record not-fielded " + hyphenate(hittype))
            .attr("fill","red")
            .attr("cx",d=>d.xpos)
            .attr("cy",d=>d.ypos)
            .attr("fill-opacity",1)
            .attr("r",2)
            .on("mouseover", function(mouse,data) {
                Tooltip.select(".tooltip-custom")
                    .attr("x",mouse.offsetX + 8)
                    .attr("y",mouse.offsetY - tooltipheight - 5)
                    .attr("height",tooltipheight)
                    .attr("width",tooltipwidth)
                    .transition()
                    .duration(150)
                    .attr("fill-opacity",1)
                    .attr("stroke-opacity",1);

                Tooltip.select(".tooltip-text")
                    .attr("x",mouse.offsetX + 10)
                    .attr("y",mouse.offsetY - 10)
                    .text(data.type + ": " + d3.format(".1f")(data.traveltime) + "s.")
                    .transition()
                    .duration(150)
                    .attr("fill-opacity",1)


                console.log(data)
                console.log(mouse)
                d3.select(this)
                    .transition()
                    .duration(150)
                    .attr("stroke", "black")
                    .attr("r",5)
                    .attr("x",d=>(d.xpos-4))
                    .attr("y",d=>(d.ypos-4))
                    .attr("width",8)
                    .attr("height",8)
            })
            .on("mouseleave", function(d) {
                Tooltip.select(".tooltip-custom")
                    .transition()
                    .duration(150)
                    .attr("fill-opacity",0)
                    .attr("stroke-opacity",0)
                    .transition()
                    .duration(0)
                    .attr("height",0)
                    .attr("width",0);

                Tooltip.select(".tooltip-text")
                    .transition()
                    .duration(150)
                    .attr("fill-opacity",0)
                    .transition()
                    .duration(0)
                    .text("")
                d3.select(this)
                    .transition()
                    .duration(150)
                    .attr("stroke", "none")
                    .attr("r",2)
                    .attr("x",d=>(d.xpos-2))
                    .attr("y",d=>(d.ypos-2))
                    .attr("width",4)
                    .attr("height",4)
            })



        //Return: svg xposition, svg yposition, time to intercept, boolean fielded?
        return [(xfieldLineScale(tempx) + fielddim/2),yfieldLineScale(tempy),mintime[1],false]
    }

    /*
    Record the x and y coordinates of the interception (tempx and tempy)
    Calculate amount of time to throw the ball to first
    Sum: mintime[1], ball transfer time, throw-to-first time
    If an out can be made:
        Plot the x and y coordinates of the ball in green
        Tag this ball with the player who made the out
        Plot a line from home plate to the ball in transparent green
        Return the x and y coordinates of the ball and the time since contact
    If an out cannot be made:
        Plot the x and y coordinates of the ball in red
        Tag this ball with the player who was closest to the out
        Plot a line from home plate to the ball in transparent red
        Return the x and y coordinates of the ball and the time since contact
    */
}

//Calculates how long it takes to throw a ball to first base, given player position and
//physical location
const firstbaselocation = components(90,Math.PI/4)
function throwtofirst(playerposition,x,y){
    //throwspeed: speed of player throw in ft/s; in the future, adjust for player arm strength
    //currently defaulting to 90mph
    const throwspeed = 90 * 1.46667

    var distancetofirst = distancecalc(x,y,firstbaselocation[0],firstbaselocation[1])

    //Calculate throwing angle based on distance from first and throwing speed
    //Using Newtonian physics
    var throwangle = Math.asin(-distancetofirst*gravity/(Math.pow(throwspeed,2))) / 2

    //Calculate x component of velocity based on throwangle
    var xthrowspeed = throwspeed * Math.cos(throwangle)

    return distancetofirst/xthrowspeed
}

//Runs the quadratic formula, returning various different outputs
function quadraticFormula(a,b,c){
    var determinant = Math.pow(b,2) - 4*a*c
    console.log(determinant)
    if (determinant < 0){
        return [0]
    }
    else if (determinant === 0){
        var eq = -b /(2*a)
        return [1,eq]
    }
    else {
        var eqplus = (-b + Math.sqrt(determinant))/(2*a)
        var eqminus = (-b - Math.sqrt(determinant))/(2*a)
        return [2,eqplus,eqminus]
    }
}

//Finds the x and y components of a certain distance of hit, assuming it originated from (0,0)
function components(distance,angle){
    return [Math.cos(angle)*distance,Math.sin(angle)*distance]
}

function distancecalc(x1, y1, x2, y2){
    return Math.sqrt(Math.pow(x2 - x1,2) + Math.pow(y2 - y1,2));
}

// Determine what kind of hit (pop fly, line drive, etc.) based on launch angle
function typeofhit(launchangle){
    /*
        From the MLB: Launch Angles:
            Ground ball: Less than 10 degrees
            Line drive: 10-25 degrees
            Fly ball: 25-50 degrees
            Pop up: Greater than 50 degrees
         */
    if (launchangle < 10){
        return "Ground Ball"
    }
    else if (launchangle < 25){
        return "Line Drive"
    }
    else if (launchangle < 50){
        return "Fly Ball"
    }
    else {
        return "Pop Up"
    }
}

// Hyphenate all spaces and lowercase a string
function hyphenate(str){
    return str.replace(/\s+/g, '-').toLowerCase();
}

function tti(xcoord,ycoord){
    var mintime = [null,0]
    var tempx;
    var tempy;
    var temptti;
    d3.selectAll(".player").each(function(d,i) {
        tempx = d3.select(this).attr("cx")
        tempy = d3.select(this).attr("cy")
        temptti = distancecalc(
            xfieldLineScale.invert(xcoord - fielddim/2),
            yfieldLineScale.invert(ycoord),
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
    return mintime
}

function calculateTimeToIntercept(launchangle,exitvelo){
    // Store the player position closest to the ball and the time to intercept

    /*
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

     */
    console.log("Pre-mintime")
    var mintime = tti(ballpos[0],ballpos[1])
    console.log("Post-mintime: ")
    console.log(mintime)

    // Record what type of hit
    var hittype = typeofhit(launchangle)



    // If the fielder can arrive in time vs. can't arrive in time (for pop ups and fly balls)
    if (mintime[1] < traveltimeglobal){
        landingData.push({
            type: hittype,
            xpos: ballpos[0],
            ypos: ballpos[1],
            launchangle: launchangle,
            exitvelo: exitvelo,
            traveltime: traveltimeglobal,
            fielded: true,
            closestplayer: mintime[0]
        })
        landings.selectAll("circle.fly.fielded")
            .data(landingData.filter(function(d) {
                return (d.fielded && ["Fly Ball","Pop Up"].includes(d.type));
            }))
            .enter()
            .append("circle")
            .attr("class","record fielded fly " + hyphenate(hittype))
            .attr("fill","green")
            .attr("cx",d=>d.xpos)
            .attr("cy",d=>d.ypos)
            .attr("fill-opacity",1)
            .attr("r",2)
            .on("mouseover", function(mouse,data) {
                Tooltip.select(".tooltip-custom")
                    .attr("x",mouse.offsetX + 8)
                    .attr("y",mouse.offsetY - tooltipheight - 5)
                    .attr("height",tooltipheight)
                    .attr("width",tooltipwidth)
                    .transition()
                    .duration(150)
                    .attr("fill-opacity",1)
                    .attr("stroke-opacity",1);

                Tooltip.select(".tooltip-text")
                    .attr("x",mouse.offsetX + 10)
                    .attr("y",mouse.offsetY - 10)
                    .text(data.type + ": " + d3.format(".1f")(data.traveltime) + "s.")
                    .transition()
                    .duration(150)
                    .attr("fill-opacity",1)


                console.log(data)
                console.log(mouse)
                d3.select(this)
                    .transition()
                    .duration(150)
                    .attr("stroke", "black")
                    .attr("r",5)
                    .attr("x",d=>(d.xpos-4))
                    .attr("y",d=>(d.ypos-4))
                    .attr("width",8)
                    .attr("height",8)
            })
            .on("mouseleave", function(d) {
                Tooltip.select(".tooltip-custom")
                    .transition()
                    .duration(150)
                    .attr("fill-opacity",0)
                    .attr("stroke-opacity",0)
                    .transition()
                    .duration(0)
                    .attr("height",0)
                    .attr("width",0);

                Tooltip.select(".tooltip-text")
                    .transition()
                    .duration(150)
                    .attr("fill-opacity",0)
                    .transition()
                    .duration(0)
                    .text("")
                d3.select(this)
                    .transition()
                    .duration(150)
                    .attr("stroke", "none")
                    .attr("r",2)
                    .attr("x",d=>(d.xpos-2))
                    .attr("y",d=>(d.ypos-2))
                    .attr("width",4)
                    .attr("height",4)
            })
    }
    else {
        landingData.push({
            type: hittype,
            xpos: ballpos[0],
            ypos: ballpos[1],
            launchangle: launchangle,
            exitvelo: exitvelo,
            traveltime: traveltimeglobal,
            fielded: false,
            closestplayer: mintime[0]
        })
        landings.selectAll("rect.fly.not-fielded")
            .data(landingData.filter(function(d) {
                return (!d.fielded && ["Fly Ball","Pop Up"].includes(d.type));
            }))
            .enter()
            .append("rect")
            .attr("class","record not-fielded fly " + hyphenate(hittype))
            .attr("fill","red")
            .attr("fill-opacity",1)
            .attr("x",d=>(d.xpos-2))
            .attr("y",d=>(d.ypos-2))
            .attr("width",4)
            .attr("height",4)
            .on("mouseover", function(mouse,data) {
                Tooltip.select(".tooltip-custom")
                    .attr("x",mouse.offsetX + 8)
                    .attr("y",mouse.offsetY - 25)
                    .attr("height",tooltipheight)
                    .attr("width",tooltipwidth)
                    .transition()
                    .duration(150)
                    .attr("fill-opacity",1)
                    .attr("stroke-opacity",1);

                Tooltip.select(".tooltip-text")
                    .attr("x",mouse.offsetX + 10)
                    .attr("y",mouse.offsetY - 10)
                    .text(data.type + ": " + d3.format(".1f")(data.traveltime) + "s.")
                    .transition()
                    .duration(150)
                    .attr("fill-opacity",1)


                console.log(data)
                console.log(mouse)
                d3.select(this)
                    .transition()
                    .duration(150)
                    .attr("stroke", "black")
                    .attr("r",5)
                    .attr("x",d=>(d.xpos-4))
                    .attr("y",d=>(d.ypos-4))
                    .attr("width",8)
                    .attr("height",8)
            })
            .on("mouseleave", function(d) {
                Tooltip.select(".tooltip-custom")
                    .transition()
                    .duration(150)
                    .attr("fill-opacity",0)
                    .attr("stroke-opacity",0)
                    .transition()
                    .duration(0)
                    .attr("height",0)
                    .attr("width",0);

                Tooltip.select(".tooltip-text")
                    .transition()
                    .duration(150)
                    .attr("fill-opacity",0)
                    .transition()
                    .duration(0)
                    .text("")
                d3.select(this)
                    .transition()
                    .duration(150)
                    .attr("stroke", "none")
                    .attr("r",2)
                    .attr("x",d=>(d.xpos-2))
                    .attr("y",d=>(d.ypos-2))
                    .attr("width",4)
                    .attr("height",4)
            })
    }

    return mintime[1] < traveltimeglobal
}

function clearLandings(){
    landingData = []
    landings.selectAll(".record")
        .transition()
        .attr("fill-opacity",0)
        .attr("stroke-opacity",0)
        .transition()
        .remove()

    ball.transition()
        .attr("cx", xfieldLineScale(0) + fielddim/2)
        .attr("cy", yfieldLineScale(0))
        .attr("r",ballRad)
        .attr("fill-opacity",0);

}

// Input: Field position of player (e.g. 3B, SS)
// Output: x or y SVG coordinate of the player on the pitch
function positionSVGCoords(position,dimension){
    if (dimension === "x"){
        if (position === "P") {return 0}
        else if (position === "C") {return 0}
        else if (position === "OneB") {return 55}
        else if (position === "TwoB") {return 10}
        else if (position === "ThreeB") {return -55}
        else if (position === "SS") {return -25}
        else if (position === "RF") {return 150}
        else if (position === "LF") {return -150}
        else if (position === "CF") {return 0}

        else {return 50;}
    }
    else {
        if (position === "P") {return 60.5;}
        else if (position === "C") {return 0}
        else if (position === "OneB") {return 65}
        else if (position === "TwoB") {return 120}
        else if (position === "ThreeB") {return 95}
        else if (position === "SS") {return 120}
        else if (position === "RF") {return 225}
        else if (position === "LF") {return 225}
        else if (position === "CF") {return 300}
        else {return 0;}
    }

}

/* ---------------------------------------------------------------------------
Writing Hit Filter Code
--------------------------------------------------------------------------- */
var hitfilter = [];

var flyballcheckbox = document.getElementById("filter-fly-balls");
var popupcheckbox = document.getElementById("filter-pop-ups");

flyballcheckbox.addEventListener( 'change', function() {
    if(this.checked) {
        hitfilter.push("fly-ball")
    } else {
        hitfilter = hitfilter.filter(type => type !== "fly-ball")
    }
    filterByHit()
});

popupcheckbox.addEventListener( 'change', function() {
    if(this.checked) {
        hitfilter.push("pop-up")
    } else {
        hitfilter = hitfilter.filter(type => type !== "pop-up")
    }
    filterByHit()
});

function filterByHit(){
    //Pull the types into array "hitfilter"
    //In the event of empyt hitfilter
    if (hitfilter === undefined || hitfilter.length == 0) {
        hitfilter = ["fly-ball","pop-up","ground-ball","line-drive"]
    }

    console.log(hitfilter)
    d3.selectAll(".record")
        .filter(function() {
            for (var i = 0; i < hitfilter.length; i++)
                if (this.classList.contains(hitfilter[i])){
                    return false
                }
            return true
        })
        .transition()
        .attr("fill-opacity",.2);

    d3.selectAll(".record")
        .filter(function() {
            for (var i = 0; i < hitfilter.length; i++)
                if (this.classList.contains(hitfilter[i])){
                    return true
                }
            return false
        })
        .transition()
        .attr("fill-opacity",1);

    if (hitfilter.length === 4) {
        hitfilter = []
    }

}

