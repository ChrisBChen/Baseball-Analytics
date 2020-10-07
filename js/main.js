let margin = {top: 40, right: 10, bottom: 60, left: 60};

let width = 600 - margin.left - margin.right,
    height = 600 - margin.top - margin.bottom;

//Separate field dimensions without margins
let fielddim = 500;

//Set player radius
let playerRad = 5

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

drawField();
drawPlayers("data/players.csv");

function drawField(){
    let field = d3.select("#field").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    field.append("path")
        .attr("id","field")
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

            // Define player group
            let players = d3.select("#field").select("svg")
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