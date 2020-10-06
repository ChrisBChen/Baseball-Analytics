let margin = {top: 40, right: 10, bottom: 60, left: 60};

let width = 600 - margin.left - margin.right,
    height = 600 - margin.top - margin.bottom;

//Separate field dimensions without margins
let fielddim = 500;

//Distance of the foul line to the fence from homeplate, in feet
// (i.e. home plate to left field wall, along the foul line)
let outfieldFoulFenceDistance = 325
// Calculate x and y components of the foul line
const oFFDy = Math.cos(Math.PI/2) * outfieldFoulFenceDistance

//Distance between bases (e.g. home to first)
let baseDistance = 90
// Calculate x and y components of the distance
const bDy = Math.cos(Math.PI/2) * baseDistance

let yfieldLineScale = d3.scaleLinear()
    .domain([0,oFFDy])
    .range([450,200])

let xfieldLineScale = d3.scaleLinear()
    .domain([0,oFFDy])
    .range([0,250])

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
        .attr("d","M 250 450 L " +
            (fielddim/2 - xfieldLineScale(oFFDy)) + " " + yfieldLineScale(oFFDy) +
            " Q 100 50 250 50 Q 400 50 " +
            (xfieldLineScale(oFFDy) + fielddim/2) + " " + yfieldLineScale(oFFDy) +
            " Z");

    field.append("path")
        .attr("id","infield")
        .attr("stroke","black")
        .attr("fill","white")
        .attr("d","M 250 450 L " +
            (fielddim/2 - xfieldLineScale(bDy)) + " " + yfieldLineScale(bDy) +
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
            let players = d3.select("#field").select("svg")
                .append("g")
                .attr("id","players");

            players.selectAll("circle")
                .data(data)
                .enter()
                .append("circle");/*
                .attr("x")
*/
        })
}