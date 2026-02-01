export function createSimulator(config = {}) {
    const settings = {
        fieldSelector: '#field',
        dataUrl: 'data/players.csv',
        buttonSelectors: {
            singleHit: '#ball-gen',
            hundredHits: '#ball-gen-100',
            clearLandings: '#clear-landings',
            resetPlayers: '#reset-players'
        },
        filterSelectors: {
            flyBalls: '#filter-fly-balls',
            popUps: '#filter-pop-ups',
            groundBalls: '#filter-ground-balls'
        },
        ...config
    };

    // NOTE: player sprint speed is in ft/s
    const margin = {top: 40, right: 10, bottom: 60, left: 60};
    const width = 600 - margin.left - margin.right;
    const height = 600 - margin.top - margin.bottom;

    // Separate field dimensions without margins
    const fielddim = 500;

    // Set player and ball icon radii
    const playerRad = 5;
    const ballRad = 2.5;

    // Set player fill color
    const playerColor = '#005C5C';

    // Gravity
    const gravity = -32.17;

    // Set maximum batter exit velo; default is 120 mph
    const maxExitVeloMPH = 120;
    const maxExitVelofps = maxExitVeloMPH * 1.46667;
    // Set minimum batter exit velo; default is 60 mph
    const minExitVeloMPH = 60;
    const minExitVelofps = minExitVeloMPH * 1.46667;
    // Set average batter exit angle; default is 30 degrees
    const exitAngleDeg = 30;
    const exitAngleRad = exitAngleDeg / 180 * Math.PI;
    // Set player reaction time; default is 0.2 sec for infield and 0.5 sec for outfield
    const rtimeInfield = 0.2;
    const rtimeOutfield = 0.5;

    // Set who is in the outfield
    const outfield = ['LF', 'CF', 'RF'];

    // Distance of the foul line to the fence from homeplate, in feet
    // (i.e. home plate to left field wall, along the foul line)
    const outfieldFoulFenceDistance = 325;
    // Calculate x and y components of the foul line
    const oFFDy = Math.cos(Math.PI / 4) * outfieldFoulFenceDistance;

    // Distance between bases (e.g. home to first)
    const baseDistance = 90;
    // Calculate x and y components of the distance
    const bDy = Math.cos(Math.PI / 4) * baseDistance;

    const yfieldLineScale = d3.scaleLinear()
        .domain([0, oFFDy])
        .range([450, 200]);

    const xfieldLineScale = d3.scaleLinear()
        .domain([-oFFDy, oFFDy])
        .range([-250, 250]);

    // Set tooltip box height and width
    const tooltipheight = 20;
    const tooltipwidth = 140;

    // Initialize global variables
    let players;
    let field;
    let ball;
    let landings;
    let groundBallLines;
    let ballpos = [];
    let csvData;
    let traveltimeglobal;
    let landingData = [];
    let Tooltip;
    let hitfilter = [];

    const fieldSelection = d3.select(settings.fieldSelector);

    function drawField() {
        field = fieldSelection.append('svg')
            .attr('id', 'field-svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        field.append('path')
            .attr('id', 'fieldline')
            .attr('stroke', 'black')
            .attr('fill', 'white')
            .attr('pointer-events', 'all')
            .attr('d', `M 250 450 L ${fielddim / 2 + xfieldLineScale(-oFFDy)} ${yfieldLineScale(oFFDy)}`
                + ` Q 100 50 250 50 Q 400 50 ${xfieldLineScale(oFFDy) + fielddim / 2} ${yfieldLineScale(oFFDy)} Z`);

        field.append('path')
            .attr('id', 'infield')
            .attr('stroke', 'black')
            .attr('fill', 'white')
            .attr('d', `M 250 450 L ${fielddim / 2 + xfieldLineScale(-bDy)} ${yfieldLineScale(bDy)}`
                + ` L ${fielddim / 2} ${yfieldLineScale(2 * bDy)} L ${xfieldLineScale(bDy) + fielddim / 2} ${yfieldLineScale(bDy)} Z`);
    }

    function drawPlayers(inputPlayers) {
        d3.csv(inputPlayers, (row) => {
            row.number = +row.number;
            row.speed = +row.speed;
            row.skill = +row.skill;

            function cleanPosition(input) {
                if (input === '1B') {
                    return 'OneB';
                }
                if (input === '2B') {
                    return 'TwoB';
                }
                if (input === '3B') {
                    return 'ThreeB';
                }
                return input;
            }

            row.position = cleanPosition(row.position);
            return row;
        }).then((data) => {
            csvData = data;

            groundBallLines = fieldSelection.select('svg')
                .append('g')
                .attr('id', 'groundBallLines')
                .attr('transform', `translate(${margin.left},${margin.top})`);

            landings = fieldSelection.select('svg')
                .append('g')
                .attr('transform', `translate(${margin.left},${margin.top})`);

            players = fieldSelection.select('svg')
                .append('g')
                .attr('id', 'players')
                .attr('transform', `translate(${margin.left},${margin.top})`);

            players.selectAll('circle')
                .data(data)
                .enter()
                .append('circle')
                .attr('class', 'player')
                .attr('id', d => d.position)
                .attr('r', playerRad)
                .attr('cx', d => xfieldLineScale(positionSVGCoords(d.position, 'x')) + fielddim / 2)
                .attr('cy', d => yfieldLineScale(positionSVGCoords(d.position, 'y')))
                .attr('fill', playerColor);

            const drag = d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended);

            players.selectAll('circle')
                .call(drag);

            ball = fieldSelection.select('svg')
                .append('g')
                .attr('id', 'ball-group')
                .attr('transform', `translate(${margin.left},${margin.top})`)
                .append('circle')
                .attr('id', 'ball')
                .attr('cx', xfieldLineScale(0) + fielddim / 2)
                .attr('cy', yfieldLineScale(0))
                .attr('r', ballRad)
                .attr('fill', 'red')
                .attr('fill-opacity', 0);

            Tooltip = fieldSelection
                .select('svg')
                .append('g')
                .attr('id', 'tooltip-group');

            Tooltip.append('rect')
                .attr('class', 'tooltip-custom')
                .attr('fill', 'white')
                .attr('fill-opacity', 0)
                .attr('stroke-opacity', 0)
                .attr('stroke', 'black')
                .attr('stroke-width', 1)
                .attr('height', 0)
                .attr('width', 0)
                .attr('x', 0)
                .attr('y', 0);

            Tooltip.append('text')
                .attr('class', 'tooltip-text')
                .attr('fill', 'black')
                .attr('x', 10)
                .attr('y', 10);
        });
    }

    function resetPlayers() {
        players.selectAll('circle')
            .transition()
            .attr('cx', d => xfieldLineScale(positionSVGCoords(d.position, 'x')) + fielddim / 2)
            .attr('cy', d => yfieldLineScale(positionSVGCoords(d.position, 'y')));
    }

    function dragstarted(event, datum) {
        d3.selectAll(`#${datum.position}`)
            .transition()
            .ease(d3.easeCubicInOut)
            .attr('r', playerRad * 2);
    }

    function dragged(event) {
        const tempx = xfieldLineScale.invert(event.x - fielddim / 2);
        const tempy = yfieldLineScale.invert(event.y);
        d3.select(event.sourceEvent.target)
            .attr('cx', xfieldLineScale(tempx) + fielddim / 2)
            .attr('cy', yfieldLineScale(tempy));
    }

    function dragended(event, datum) {
        d3.selectAll(`#${datum.position}`)
            .transition()
            .ease(d3.easeCubicInOut)
            .attr('r', playerRad);
    }

    function betterGenBall100() {
        for (let i = 0; i < 100; i += 1) {
            let tempcoords;
            let traveltime;
            let yvelo;
            let launchangle;
            let exitvelo;
            let grounderdata = [];
            let forceFlyBall = false;

            const path = document.getElementById('fieldline');
            const testpoint = document.getElementById('field-svg').createSVGPoint();

            const tempangle = Math.random() * Math.PI / 2 + (Math.PI / 4);

            do {
                let approved;
                do {
                    launchangle = d3.randomNormal(10, 70 / 3)();

                    if (forceFlyBall) {
                        approved = (launchangle < 25);
                    } else {
                        approved = (launchangle < 25 && launchangle >= 10);
                    }
                } while (approved);

                if (launchangle >= 25) {
                    forceFlyBall = true;
                }

                exitvelo = d3.randomNormal([89], [10.33])();
                exitvelo *= 1.46667;

                const xvelo = Math.cos(launchangle * Math.PI / 180) * exitvelo;
                yvelo = Math.sin(launchangle * Math.PI / 180) * exitvelo;

                const contactheight = d3.randomNormal(2.5, 1 / 3)();

                if (launchangle < 10 && !forceFlyBall) {
                    grounderdata = groundBallTTI(tempangle, xvelo, launchangle, exitvelo);
                    break;
                }

                const traveltimearray = quadraticFormula(0.5 * gravity, yvelo, -contactheight);

                if (traveltimearray[0] === 0) {
                    traveltime = null;
                } else if (traveltimearray[0] === 1) {
                    traveltime = traveltimearray[1];
                } else {
                    traveltime = Math.max(traveltimearray[1], traveltimearray[2]);
                }

                const distance = xvelo * traveltime;
                tempcoords = components(distance, tempangle);

                testpoint.x = xfieldLineScale(tempcoords[0]) + fielddim / 2;
                testpoint.y = yfieldLineScale(tempcoords[1]);
            } while (!(path.isPointInFill(testpoint)));

            if (grounderdata.length !== 0) {
                ballpos = [grounderdata[0], grounderdata[1]];
                traveltimeglobal = grounderdata[2];
            } else {
                const svgcoords = [xfieldLineScale(tempcoords[0]) + fielddim / 2, yfieldLineScale(tempcoords[1])];

                ballpos = [svgcoords[0], svgcoords[1]];
                traveltimeglobal = traveltime;
                calculateTimeToIntercept(launchangle, exitvelo);
            }
        }
        filterByHit();
    }

    function betterGenBall() {
        let tempcoords;
        let traveltime;
        let yvelo;
        let launchangle;
        let exitvelo;
        let grounderdata = [];
        let forceFlyBall = false;

        const path = document.getElementById('fieldline');
        const testpoint = document.getElementById('field-svg').createSVGPoint();

        const tempangle = Math.random() * Math.PI / 2 + (Math.PI / 4);

        do {
            let approved;

            do {
                launchangle = d3.randomNormal(10, 70 / 3)();

                if (forceFlyBall) {
                    approved = (launchangle < 25);
                } else {
                    approved = (launchangle < 25 && launchangle >= 10);
                }
            } while (approved);

            if (launchangle >= 25) {
                forceFlyBall = true;
            }

            exitvelo = d3.randomNormal([89], [10.33])();
            exitvelo *= 1.46667;

            const xvelo = Math.cos(launchangle * Math.PI / 180) * exitvelo;
            yvelo = Math.sin(launchangle * Math.PI / 180) * exitvelo;

            const contactheight = d3.randomNormal(2.5, 1 / 3)();

            if (launchangle < 10 && !forceFlyBall) {
                grounderdata = groundBallTTI(tempangle, xvelo, launchangle, exitvelo);
                break;
            }

            const traveltimearray = quadraticFormula(0.5 * gravity, yvelo, -contactheight);

            if (traveltimearray[0] === 0) {
                traveltime = null;
            } else if (traveltimearray[0] === 1) {
                traveltime = traveltimearray[1];
            } else {
                traveltime = Math.max(traveltimearray[1], traveltimearray[2]);
            }

            const distance = xvelo * traveltime;
            tempcoords = components(distance, tempangle);

            testpoint.x = xfieldLineScale(tempcoords[0]) + fielddim / 2;
            testpoint.y = yfieldLineScale(tempcoords[1]);
        }
        while (!(path.isPointInFill(testpoint)));

        if (grounderdata.length !== 0) {
            ballpos = [grounderdata[0], grounderdata[1]];
            traveltimeglobal = grounderdata[2];
            const caught = grounderdata[3];

            filterByHit();

            d3.select('#ball')
                .transition()
                .duration(250)
                .attr('fill', () => (caught ? 'green' : 'red'))
                .attr('cx', xfieldLineScale(0) + fielddim / 2)
                .attr('cy', yfieldLineScale(0))
                .transition()
                .duration(traveltimeglobal * 1000)
                .ease(d3.easeCubicOut)
                .attr('fill-opacity', 100)
                .attr('cx', ballpos[0])
                .attr('cy', ballpos[1])
                .attr('r', ballRad);
        } else {
            const svgcoords = [xfieldLineScale(tempcoords[0]) + fielddim / 2, yfieldLineScale(tempcoords[1])];
            const halfsvgcoords = [xfieldLineScale(tempcoords[0] / 2) + fielddim / 2, yfieldLineScale(tempcoords[1] / 2)];

            const ballheight = Math.pow(yvelo, 2) / (-2 * gravity);
            const ballScale = d3.scaleLinear()
                .domain([0, 1579])
                .range([5, 15]);

            ballpos = [svgcoords[0], svgcoords[1]];

            traveltimeglobal = traveltime;

            const caught = calculateTimeToIntercept(launchangle, exitvelo);

            filterByHit();

            d3.select('#ball')
                .transition()
                .duration(250)
                .attr('fill', () => (caught ? 'green' : 'red'))
                .attr('cx', xfieldLineScale(0) + fielddim / 2)
                .attr('cy', yfieldLineScale(0))
                .transition()
                .ease(d3.easeLinear)
                .duration(traveltime * 500)
                .attr('fill-opacity', 100)
                .attr('cx', halfsvgcoords[0])
                .attr('cy', halfsvgcoords[1])
                .attr('r', ballScale(ballheight))
                .transition()
                .ease(d3.easeLinear)
                .duration(traveltime * 500)
                .attr('cx', svgcoords[0])
                .attr('cy', svgcoords[1])
                .attr('r', ballRad);
        }
    }

    function groundBallTTI(tempangle, xvelo, launchangle, exitvelo) {
        const path = document.getElementById('fieldline');
        const testpoint = document.getElementById('field-svg').createSVGPoint();

        const deltaT = 0.1;

        const ballfric = 0.5;
        const ballacc = -ballfric * gravity;

        const maxdistancetime = xvelo / ballacc;
        const maxdistance = Math.pow(xvelo, 2) / (2 * ballacc);
        const maxdistancecomponents = components(maxdistance, tempangle);
        const xvelocomponents = components(xvelo, tempangle);
        let tempx = 0;
        let tempy = 0;
        let mintime = [null, 0];
        let elapsedtime = 0;
        let stepx = 0;
        let stepy = 0;

        do {
            stepx += xvelocomponents[0] * deltaT;
            stepy += xvelocomponents[1] * deltaT;
            testpoint.x = xfieldLineScale(stepx) + fielddim / 2;
            testpoint.y = yfieldLineScale(stepy);
            if (!(path.isPointInFill(testpoint))) {
                break;
            }

            elapsedtime += deltaT;
            tempx = stepx;
            tempy = stepy;

            if (elapsedtime > maxdistancetime) {
                elapsedtime = maxdistancetime;
                tempx = maxdistancecomponents[0];
                tempy = maxdistancecomponents[1];
            }

            mintime = tti(xfieldLineScale(tempx) + fielddim / 2, yfieldLineScale(tempy));
        }
        while (elapsedtime < maxdistancetime && elapsedtime < mintime[1]);

        const timetofirst = throwtofirst(mintime[0], tempx, tempy);
        const transfertime = 0.2;
        const runnertime = 4.25;
        const totaltime = mintime[1] + transfertime + timetofirst;

        const hittype = 'Ground Ball';
        if (totaltime < runnertime) {
            landingData.push({
                type: hittype,
                xpos: xfieldLineScale(tempx) + fielddim / 2,
                ypos: yfieldLineScale(tempy),
                launchangle,
                exitvelo,
                traveltime: mintime[1],
                fielded: true,
                closestplayer: mintime[0]
            });

            groundBallLines.selectAll('line.ground-ball.fielded')
                .data(landingData.filter((d) => (d.fielded && d.type === 'Ground Ball')))
                .enter()
                .append('line')
                .attr('class', `record fielded line ${hyphenate(hittype)}`)
                .attr('x1', xfieldLineScale(0) + fielddim / 2)
                .attr('y1', yfieldLineScale(0))
                .attr('x2', d => d.xpos)
                .attr('y2', d => d.ypos)
                .attr('stroke', '#90ee90')
                .attr('stroke-opacity', 1);

            landings.selectAll('circle.ground-ball.fielded')
                .data(landingData.filter((d) => (d.fielded && d.type === 'Ground Ball')))
                .enter()
                .append('circle')
                .attr('class', `record fielded ${hyphenate(hittype)}`)
                .attr('fill', 'green')
                .attr('cx', d => d.xpos)
                .attr('cy', d => d.ypos)
                .attr('fill-opacity', 1)
                .attr('r', 2)
                .on('mouseover', function mouseoverHandler(mouse, data) {
                    Tooltip.select('.tooltip-custom')
                        .attr('x', mouse.offsetX + 8)
                        .attr('y', mouse.offsetY - tooltipheight - 5)
                        .attr('height', tooltipheight)
                        .attr('width', tooltipwidth)
                        .transition()
                        .duration(150)
                        .attr('fill-opacity', 1)
                        .attr('stroke-opacity', 1);

                    Tooltip.select('.tooltip-text')
                        .attr('x', mouse.offsetX + 10)
                        .attr('y', mouse.offsetY - 10)
                        .text(`${data.type}: ${d3.format('.1f')(data.traveltime)}s.`)
                        .transition()
                        .duration(150)
                        .attr('fill-opacity', 1);

                    d3.select(this)
                        .transition()
                        .duration(150)
                        .attr('stroke', 'black')
                        .attr('r', 5)
                        .attr('x', d => (d.xpos - 4))
                        .attr('y', d => (d.ypos - 4))
                        .attr('width', 8)
                        .attr('height', 8);
                })
                .on('mouseleave', function mouseleaveHandler() {
                    Tooltip.select('.tooltip-custom')
                        .transition()
                        .duration(150)
                        .attr('fill-opacity', 0)
                        .attr('stroke-opacity', 0)
                        .transition()
                        .duration(0)
                        .attr('height', 0)
                        .attr('width', 0);

                    Tooltip.select('.tooltip-text')
                        .transition()
                        .duration(150)
                        .attr('fill-opacity', 0)
                        .transition()
                        .duration(0)
                        .text('');
                    d3.select(this)
                        .transition()
                        .duration(150)
                        .attr('stroke', 'none')
                        .attr('r', 2)
                        .attr('x', d => (d.xpos - 2))
                        .attr('y', d => (d.ypos - 2))
                        .attr('width', 4)
                        .attr('height', 4);
                });

            return [xfieldLineScale(tempx) + fielddim / 2, yfieldLineScale(tempy), mintime[1], true];
        }

        landingData.push({
            type: hittype,
            xpos: xfieldLineScale(tempx) + fielddim / 2,
            ypos: yfieldLineScale(tempy),
            launchangle,
            exitvelo,
            traveltime: mintime[1],
            fielded: false,
            closestplayer: mintime[0]
        });

        groundBallLines.selectAll('line.ground-ball.not-fielded')
            .data(landingData.filter((d) => (!d.fielded && d.type === 'Ground Ball')))
            .enter()
            .append('line')
            .attr('class', `record not-fielded line ${hyphenate(hittype)}`)
            .attr('x1', xfieldLineScale(0) + fielddim / 2)
            .attr('y1', yfieldLineScale(0))
            .attr('x2', d => d.xpos)
            .attr('y2', d => d.ypos)
            .attr('stroke', '#ffcccb')
            .attr('stroke-opacity', 1);

        landings.selectAll('circle.ground-ball.not-fielded')
            .data(landingData.filter((d) => ((!d.fielded) && d.type === 'Ground Ball')))
            .enter()
            .append('circle')
            .attr('class', `record not-fielded ${hyphenate(hittype)}`)
            .attr('fill', 'red')
            .attr('cx', d => d.xpos)
            .attr('cy', d => d.ypos)
            .attr('fill-opacity', 1)
            .attr('r', 2)
            .on('mouseover', function mouseoverHandler(mouse, data) {
                Tooltip.select('.tooltip-custom')
                    .attr('x', mouse.offsetX + 8)
                    .attr('y', mouse.offsetY - tooltipheight - 5)
                    .attr('height', tooltipheight)
                    .attr('width', tooltipwidth)
                    .transition()
                    .duration(150)
                    .attr('fill-opacity', 1)
                    .attr('stroke-opacity', 1);

                Tooltip.select('.tooltip-text')
                    .attr('x', mouse.offsetX + 10)
                    .attr('y', mouse.offsetY - 10)
                    .text(`${data.type}: ${d3.format('.1f')(data.traveltime)}s.`)
                    .transition()
                    .duration(150)
                    .attr('fill-opacity', 1);

                d3.select(this)
                    .transition()
                    .duration(150)
                    .attr('stroke', 'black')
                    .attr('r', 5)
                    .attr('x', d => (d.xpos - 4))
                    .attr('y', d => (d.ypos - 4))
                    .attr('width', 8)
                    .attr('height', 8);
            })
            .on('mouseleave', function mouseleaveHandler() {
                Tooltip.select('.tooltip-custom')
                    .transition()
                    .duration(150)
                    .attr('fill-opacity', 0)
                    .attr('stroke-opacity', 0)
                    .transition()
                    .duration(0)
                    .attr('height', 0)
                    .attr('width', 0);

                Tooltip.select('.tooltip-text')
                    .transition()
                    .duration(150)
                    .attr('fill-opacity', 0)
                    .transition()
                    .duration(0)
                    .text('');
                d3.select(this)
                    .transition()
                    .duration(150)
                    .attr('stroke', 'none')
                    .attr('r', 2)
                    .attr('x', d => (d.xpos - 2))
                    .attr('y', d => (d.ypos - 2))
                    .attr('width', 4)
                    .attr('height', 4);
            });

        return [xfieldLineScale(tempx) + fielddim / 2, yfieldLineScale(tempy), mintime[1], false];
    }

    const firstbaselocation = components(90, Math.PI / 4);
    function throwtofirst(playerposition, x, y) {
        const throwspeed = 90 * 1.46667;
        const distancetofirst = distancecalc(x, y, firstbaselocation[0], firstbaselocation[1]);
        const throwangle = Math.asin(-distancetofirst * gravity / (Math.pow(throwspeed, 2))) / 2;
        const xthrowspeed = throwspeed * Math.cos(throwangle);

        return distancetofirst / xthrowspeed;
    }

    function quadraticFormula(a, b, c) {
        const determinant = Math.pow(b, 2) - 4 * a * c;

        if (determinant < 0) {
            return [0];
        }
        if (determinant === 0) {
            const eq = -b / (2 * a);
            return [1, eq];
        }
        const eqplus = (-b + Math.sqrt(determinant)) / (2 * a);
        const eqminus = (-b - Math.sqrt(determinant)) / (2 * a);
        return [2, eqplus, eqminus];
    }

    function components(distance, angle) {
        return [Math.cos(angle) * distance, Math.sin(angle) * distance];
    }

    function distancecalc(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }

    function typeofhit(launchangle) {
        if (launchangle < 10) {
            return 'Ground Ball';
        }
        if (launchangle < 25) {
            return 'Line Drive';
        }
        if (launchangle < 50) {
            return 'Fly Ball';
        }
        return 'Pop Up';
    }

    function hyphenate(str) {
        return str.replace(/\s+/g, '-').toLowerCase();
    }

    function tti(xcoord, ycoord) {
        let mintime = [null, 0];
        let tempx;
        let tempy;
        let temptti;
        d3.selectAll('.player').each(function eachPlayer(d, i) {
            tempx = d3.select(this).attr('cx');
            tempy = d3.select(this).attr('cy');
            temptti = distancecalc(
                xfieldLineScale.invert(xcoord - fielddim / 2),
                yfieldLineScale.invert(ycoord),
                xfieldLineScale.invert(tempx - fielddim / 2),
                yfieldLineScale.invert(tempy)
            ) / csvData[i].speed;

            if (outfield.includes(d3.select(this).attr('id'))) {
                temptti += rtimeOutfield;
            } else {
                temptti += rtimeInfield;
            }

            if (i === 0 || temptti < mintime[1]) {
                mintime = [d3.select(this).attr('id'), temptti];
            }
        });
        return mintime;
    }

    function calculateTimeToIntercept(launchangle, exitvelo) {
        const mintime = tti(ballpos[0], ballpos[1]);
        const hittype = typeofhit(launchangle);

        if (mintime[1] < traveltimeglobal) {
            landingData.push({
                type: hittype,
                xpos: ballpos[0],
                ypos: ballpos[1],
                launchangle,
                exitvelo,
                traveltime: traveltimeglobal,
                fielded: true,
                closestplayer: mintime[0]
            });
            landings.selectAll('circle.fly.fielded')
                .data(landingData.filter((d) => (d.fielded && ['Fly Ball', 'Pop Up'].includes(d.type))))
                .enter()
                .append('circle')
                .attr('class', `record fielded fly ${hyphenate(hittype)}`)
                .attr('fill', 'green')
                .attr('cx', d => d.xpos)
                .attr('cy', d => d.ypos)
                .attr('fill-opacity', 1)
                .attr('r', 2)
                .on('mouseover', function mouseoverHandler(mouse, data) {
                    Tooltip.select('.tooltip-custom')
                        .attr('x', mouse.offsetX + 8)
                        .attr('y', mouse.offsetY - tooltipheight - 5)
                        .attr('height', tooltipheight)
                        .attr('width', tooltipwidth)
                        .transition()
                        .duration(150)
                        .attr('fill-opacity', 1)
                        .attr('stroke-opacity', 1);

                    Tooltip.select('.tooltip-text')
                        .attr('x', mouse.offsetX + 10)
                        .attr('y', mouse.offsetY - 10)
                        .text(`${data.type}: ${d3.format('.1f')(data.traveltime)}s.`)
                        .transition()
                        .duration(150)
                        .attr('fill-opacity', 1);

                    d3.select(this)
                        .transition()
                        .duration(150)
                        .attr('stroke', 'black')
                        .attr('r', 5)
                        .attr('x', d => (d.xpos - 4))
                        .attr('y', d => (d.ypos - 4))
                        .attr('width', 8)
                        .attr('height', 8);
                })
                .on('mouseleave', function mouseleaveHandler() {
                    Tooltip.select('.tooltip-custom')
                        .transition()
                        .duration(150)
                        .attr('fill-opacity', 0)
                        .attr('stroke-opacity', 0)
                        .transition()
                        .duration(0)
                        .attr('height', 0)
                        .attr('width', 0);

                    Tooltip.select('.tooltip-text')
                        .transition()
                        .duration(150)
                        .attr('fill-opacity', 0)
                        .transition()
                        .duration(0)
                        .text('');
                    d3.select(this)
                        .transition()
                        .duration(150)
                        .attr('stroke', 'none')
                        .attr('r', 2)
                        .attr('x', d => (d.xpos - 2))
                        .attr('y', d => (d.ypos - 2))
                        .attr('width', 4)
                        .attr('height', 4);
                });
        } else {
            landingData.push({
                type: hittype,
                xpos: ballpos[0],
                ypos: ballpos[1],
                launchangle,
                exitvelo,
                traveltime: traveltimeglobal,
                fielded: false,
                closestplayer: mintime[0]
            });
            landings.selectAll('rect.fly.not-fielded')
                .data(landingData.filter((d) => (!d.fielded && ['Fly Ball', 'Pop Up'].includes(d.type))))
                .enter()
                .append('rect')
                .attr('class', `record not-fielded fly ${hyphenate(hittype)}`)
                .attr('fill', 'red')
                .attr('fill-opacity', 1)
                .attr('x', d => (d.xpos - 2))
                .attr('y', d => (d.ypos - 2))
                .attr('width', 4)
                .attr('height', 4)
                .on('mouseover', function mouseoverHandler(mouse, data) {
                    Tooltip.select('.tooltip-custom')
                        .attr('x', mouse.offsetX + 8)
                        .attr('y', mouse.offsetY - 25)
                        .attr('height', tooltipheight)
                        .attr('width', tooltipwidth)
                        .transition()
                        .duration(150)
                        .attr('fill-opacity', 1)
                        .attr('stroke-opacity', 1);

                    Tooltip.select('.tooltip-text')
                        .attr('x', mouse.offsetX + 10)
                        .attr('y', mouse.offsetY - 10)
                        .text(`${data.type}: ${d3.format('.1f')(data.traveltime)}s.`)
                        .transition()
                        .duration(150)
                        .attr('fill-opacity', 1);

                    d3.select(this)
                        .transition()
                        .duration(150)
                        .attr('stroke', 'black')
                        .attr('r', 5)
                        .attr('x', d => (d.xpos - 4))
                        .attr('y', d => (d.ypos - 4))
                        .attr('width', 8)
                        .attr('height', 8);
                })
                .on('mouseleave', function mouseleaveHandler() {
                    Tooltip.select('.tooltip-custom')
                        .transition()
                        .duration(150)
                        .attr('fill-opacity', 0)
                        .attr('stroke-opacity', 0)
                        .transition()
                        .duration(0)
                        .attr('height', 0)
                        .attr('width', 0);

                    Tooltip.select('.tooltip-text')
                        .transition()
                        .duration(150)
                        .attr('fill-opacity', 0)
                        .transition()
                        .duration(0)
                        .text('');
                    d3.select(this)
                        .transition()
                        .duration(150)
                        .attr('stroke', 'none')
                        .attr('r', 2)
                        .attr('x', d => (d.xpos - 2))
                        .attr('y', d => (d.ypos - 2))
                        .attr('width', 4)
                        .attr('height', 4);
                });
        }

        return mintime[1] < traveltimeglobal;
    }

    function clearLandings() {
        landingData = [];
        landings.selectAll('.record')
            .transition()
            .attr('fill-opacity', 0)
            .transition()
            .remove();

        groundBallLines.selectAll('.record')
            .transition()
            .attr('stroke-opacity', 0)
            .transition()
            .remove();

        ball.transition()
            .attr('cx', xfieldLineScale(0) + fielddim / 2)
            .attr('cy', yfieldLineScale(0))
            .attr('r', ballRad)
            .attr('fill-opacity', 0);
    }

    function positionSVGCoords(position, dimension) {
        if (dimension === 'x') {
            if (position === 'P') { return 0; }
            if (position === 'C') { return 0; }
            if (position === 'OneB') { return 55; }
            if (position === 'TwoB') { return 10; }
            if (position === 'ThreeB') { return -55; }
            if (position === 'SS') { return -25; }
            if (position === 'RF') { return 150; }
            if (position === 'LF') { return -150; }
            if (position === 'CF') { return 0; }

            return 50;
        }
        if (position === 'P') { return 60.5; }
        if (position === 'C') { return 0; }
        if (position === 'OneB') { return 65; }
        if (position === 'TwoB') { return 120; }
        if (position === 'ThreeB') { return 95; }
        if (position === 'SS') { return 120; }
        if (position === 'RF') { return 225; }
        if (position === 'LF') { return 225; }
        if (position === 'CF') { return 300; }
        return 0;
    }

    function bindFilters() {
        const flyballcheckbox = document.querySelector(settings.filterSelectors.flyBalls);
        const popupcheckbox = document.querySelector(settings.filterSelectors.popUps);
        const groundballcheckbox = document.querySelector(settings.filterSelectors.groundBalls);

        if (flyballcheckbox) {
            flyballcheckbox.addEventListener('change', function handleFlyChange() {
                if (this.checked) {
                    hitfilter.push('fly-ball');
                } else {
                    hitfilter = hitfilter.filter(type => type !== 'fly-ball');
                }
                filterByHit();
            });
        }

        if (popupcheckbox) {
            popupcheckbox.addEventListener('change', function handlePopChange() {
                if (this.checked) {
                    hitfilter.push('pop-up');
                } else {
                    hitfilter = hitfilter.filter(type => type !== 'pop-up');
                }
                filterByHit();
            });
        }

        if (groundballcheckbox) {
            groundballcheckbox.addEventListener('change', function handleGroundChange() {
                if (this.checked) {
                    hitfilter.push('ground-ball');
                } else {
                    hitfilter = hitfilter.filter(type => type !== 'ground-ball');
                }
                filterByHit();
            });
        }
    }

    function filterByHit() {
        if (hitfilter === undefined || hitfilter.length === 0) {
            hitfilter = ['fly-ball', 'pop-up', 'ground-ball', 'line-drive'];
        }

        d3.selectAll('.record')
            .filter(function filterRecords() {
                for (let i = 0; i < hitfilter.length; i += 1) {
                    if (this.classList.contains(hitfilter[i])) {
                        return false;
                    }
                }
                return true;
            })
            .transition()
            .attr('fill-opacity', 0.2)
            .attr('stroke-opacity', 0.2);

        d3.selectAll('.record')
            .filter(function filterRecords() {
                for (let i = 0; i < hitfilter.length; i += 1) {
                    if (this.classList.contains(hitfilter[i])) {
                        return true;
                    }
                }
                return false;
            })
            .transition()
            .attr('fill-opacity', 1)
            .attr('stroke-opacity', 1);

        if (hitfilter.length === 4) {
            hitfilter = [];
        }
    }

    function bindButtons() {
        const singleButton = document.querySelector(settings.buttonSelectors.singleHit);
        const hundredButton = document.querySelector(settings.buttonSelectors.hundredHits);
        const clearButton = document.querySelector(settings.buttonSelectors.clearLandings);
        const resetButton = document.querySelector(settings.buttonSelectors.resetPlayers);

        if (singleButton) {
            singleButton.addEventListener('click', betterGenBall);
        }
        if (hundredButton) {
            hundredButton.addEventListener('click', betterGenBall100);
        }
        if (clearButton) {
            clearButton.addEventListener('click', clearLandings);
        }
        if (resetButton) {
            resetButton.addEventListener('click', resetPlayers);
        }
    }

    function init() {
        drawField();
        drawPlayers(settings.dataUrl);
        bindButtons();
        bindFilters();
    }

    init();

    return {
        resetPlayers,
        clearLandings
    };
}
