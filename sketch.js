// this disables debug errors for better speed
p5.disableFriendlyErrors = true;

const circleGenerators = []
let timerMs = 0;
let isFullscreen = false;
let isDebug = false;

// parameters of visualization
let o_noiseMax = 3, 
  o_phase = 0.005, 
  o_noiseZoff = 0.005, 
  o_maxCircles = 400, 
  o_circleGrowth = 20,
  o_extraRandomDisplacement = 0, // the circles will be more noisy (use 0-100), use for example with dissonant/aggresive/loud sound
  o_fadeSpeed = 2 // 0-30 how quickly circles fades on collision
  ;

let centerX;
let centerY;

let eyeX;
let eyeY;

let lastGazePoints = []
let hasEnoughGazePoints = false;
let readyToRender = false;


//
// Eye gaze detection
//

// Kalman Filter defaults to on.
window.applyKalmanFilter = true;
// Set to true if you want to save the data even if you reload the page.
window.saveDataAcrossSessions = true;

const collisionSVG = "collisionSVG";

window.onload = async function() {
  if (!window.saveDataAcrossSessions) {
      var localstorageDataLabel = 'webgazerGlobalData';
      localforage.setItem(localstorageDataLabel, null);
      var localstorageSettingsLabel = 'webgazerGlobalSettings';
      localforage.setItem(localstorageSettingsLabel, null);
  }
  webgazer.params.showVideoPreview = true;
  const webgazerInstance = await webgazer.setRegression('ridge') /* currently must set regression and tracker */
  .setTracker('TFFacemesh')
  .begin();
  webgazerInstance.showPredictionPoints(false); /* shows a square every 100 milliseconds where current prediction is */
  // Add the SVG component on the top of everything.
  setupCollisionSystem();
  webgazer.setGazeListener( collisionEyeListener );
};

window.onbeforeunload = function() {
  if (window.saveDataAcrossSessions) {
      webgazer.end();
  } else {
      localforage.clear();
  }
}

function setupCollisionSystem() {
  var width = window.innerWidth;
  var height = window.innerHeight;

  var svg = d3.select("body").append("svg")
  .attr("id", collisionSVG)
  .attr("width", width)
  .attr("height", height)
  .style("top", "0px")
  .style("left","0px")
  .style("margin","0px")
  .style("position","absolute")
  .style("z-index", 100000);

  svg.append("line")
  .attr("id", "eyeline1" )
  .attr("stroke-width",2)
  .attr("stroke","red");

  svg.append("line")
  .attr("id", "eyeline2" )
  .attr("stroke-width",2)
  .attr("stroke","red");

  svg.append("rect")
  .attr("id","predictionSquare")
  .attr("width",5)
  .attr("height",5)
  .attr("fill","red");
}

let webgazerCanvas = null;
let previewWidth = webgazer.params.videoViewerWidth;

let collisionEyeListener = async function(data, clock) {
  if(!data)
    return;

  lastGazePoints.push([data.x, data.y]);

  if (lastGazePoints.length > 4) {
    hasEnoughGazePoints = true;

    let sumX = 0;
    let sumY = 0;
    for (const point of lastGazePoints) {
      sumX += point[0];
      sumY += point[1];
    }
    eyeX = sumX / lastGazePoints.length;
    eyeY = sumY / lastGazePoints.length;
    
    lastGazePoints.shift();
  }

  if (!webgazerCanvas) {
    webgazerCanvas = webgazer.getVideoElementCanvas();
  }

  await webgazer.getTracker().getEyePatches(webgazerCanvas, webgazerCanvas.width, webgazerCanvas.height);
  var fmPositions = await webgazer.getTracker().getPositions();

  var whr = webgazer.getVideoPreviewToCameraResolutionRatio();

    var line = d3.select('#eyeline1')
            .attr("x1",data.x)
            .attr("y1",data.y)
            .attr("x2",previewWidth - fmPositions[145][0] * whr[0])
            .attr("y2",fmPositions[145][1] * whr[1]);

    var line = d3.select("#eyeline2")
            .attr("x1",data.x)
            .attr("y1",data.y)
            .attr("x2",previewWidth - fmPositions[374][0] * whr[0])
            .attr("y2",fmPositions[374][1] * whr[1]);

  var dot = d3.select("#predictionSquare")
            .attr("x",data.x)
            .attr("y",data.y);
}


//
// P5 sketch
//

let lastFrameMillis = 0;

const uiState = {
  gazeTrainPointOpacity: 0.0,
  trainingText1Opacity: 0.0,
  trainingText2Opacity: 0.0,
  trainingText3Opacity: 0.0
}

const uiAnimTimeline = anime.timeline({
  loop: false,
  autoplay: false,
  easing: 'easeInOutSine',
}).add({
  targets: uiState,
  trainingText1Opacity: 100,
  duration: 500,
  round: 1,
  easing: 'linear',
})
.add({
  targets: uiState,
  trainingText2Opacity: 100,
  duration: 500,
  round: 1,
  easing: 'linear',
}, '+=1500')
.add({
  targets: uiState,
  trainingText3Opacity: 100,
  duration: 500,
  round: 1,
  easing: 'linear',
}, '+=2100')
.add({
  targets: uiState,
  gazeTrainPointOpacity: 100,
  round: 1,
  easing: 'linear',
  duration: 300,
}, '+=1000');


function setup() {
  pixelDensity(2.0); // if 4k, for better performance turn lower
  let canvas = createCanvas(windowWidth, windowHeight);
  timerMs = millis();
  centerX = width / 2;
  eyeX = width / 2;
  centerY = height / 2;
  eyeY = height / 2;
  background(0);

  setTimeout(
    function() {
      uiAnimTimeline.play();
    }, 100);
}

function mapCubed(value, start1, stop1, start2, stop2) {
  let inT = map(value, start1, stop1, 0, 1);
  let outT = inT * inT * inT;
  return map(outT, 0, 1, start2, stop2);
}

function draw() {
  const timePassedFromLastFrame = millis() - lastFrameMillis;
  lastFrameMillis = millis();
  //console.log("Time passed: "+timePassedFromLastFrame);

  if (isDebug && hasEnoughGazePoints) {
    readyToRender = true;
  }

  background(0,0,0,15);
  
  let eyeDistFromCenter = sqrt(pow(eyeX - centerX, 2) + pow(eyeY - centerY, 2));

  if (readyToRender && circleGenerators.length === 0) {
    circleGenerators.push(new CircleGenerator(centerX, centerY));
  }
  // visualize user gaze
  if (!isDebug) {
    push();
    colorMode(HSB, 360, 100, 100, 100);
    fill(360, 100, 100, 100);
    rect(eyeX, eyeY, 10, 10);
    pop();
  }

  //print fps and circle counts
  if (!isDebug) {
    push();
    textAlign(LEFT);
    textSize(10);
    fill(255);
    //text(circleGenerators[0].getCircles().length, 10, 350);
    //text(eyeX, 10, 400);
    //text(eyeY, 40, 400);
    //text("eye dist from center: " + eyeDistFromCenter, 200, 400);
    //text("fps: " + frameRate(), 70, height - 20);
    textSize(16);
    textAlign(CENTER);
    fill(255, uiState.trainingText1Opacity);
    text("The application recognizes where you look using your web camera.", width / 2, height / 2 - 100);
    fill(255, uiState.trainingText2Opacity);
    text("It needs to be trained first. Allow the access to camera in browser.", width / 2, height / 2 - 70);
    fill(255, uiState.trainingText3Opacity);
    text("Stare at each of the blue rectangles, and click on them 5 times. You can focus on the cursor.", width / 2, height / 2 + 50);
    text("When gaze detection is good enough, F to fully immerse into the experience. Press <space> to reset circles.", width / 2, height / 2 + 80);

    colorMode(HSB, 360, 100, 100, 100);
    fill(200, 100, 100, uiState.gazeTrainPointOpacity);
    const SIZE = 15, MARGIN = 20;
    rect(MARGIN, MARGIN, SIZE, SIZE);
    rect(width / 2, MARGIN, SIZE, SIZE);
    rect(width - MARGIN - SIZE, MARGIN, SIZE, SIZE);

    rect(MARGIN, height / 2, SIZE, SIZE);
    rect(width / 2, height / 2, SIZE, SIZE);
    rect(width - MARGIN - SIZE, height / 2, SIZE, SIZE);

    rect(MARGIN, height - MARGIN - SIZE, SIZE, SIZE);
    rect(width / 2, height - MARGIN - SIZE, SIZE, SIZE);
    rect(width - MARGIN - SIZE, height - MARGIN - SIZE, SIZE, SIZE);

    pop();
  }

  if (eyeDistFromCenter > 150) {
    o_noiseMax = mapCubed(eyeDistFromCenter, 0, 700, 0.01, 1, false); 
    o_phase = mapCubed(eyeDistFromCenter, 0, 700, 0.001, 0.01, false);
    o_circleGrowth = mapCubed(eyeDistFromCenter, 0, 700, 0.05, 20, false);
  } else {
    o_noiseMax = mapCubed(eyeDistFromCenter, 0, 150, 0.0001, 0.01, false); 
    o_phase = mapCubed(eyeDistFromCenter, 0, 150, 0.0005, 0.001, false);
    o_circleGrowth = mapCubed(eyeDistFromCenter, 0, 150, 0.005, 0.05, false);
  }

  if (!readyToRender) {
    return
  }

  // update circle generators
  for (let i = 0; i < circleGenerators.length; i++) {
    const generator = circleGenerators[i];
    generator.update(timePassedFromLastFrame, o_circleGrowth, o_phase);
    generator.draw();
  }

  // generate new circles
  if (millis() > timerMs + random(200,500))
  {
    for (let c of circleGenerators) {
      if (o_maxCircles > c.getCircles().length) {
        c.generateNow();
      }
    }
    timerMs = millis();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function keyPressed() {
  if (key === " ") {
    for (const g of circleGenerators) {
      g.circles = [];
    }
  } 
  else if (key === "f") {
    if (!isDebug) {
      isDebug = true;
      hideDebug();
    }
    isFullscreen = !fullscreen();
    fullscreen(isFullscreen);
  } 
  else if (key === "d") {
    isDebug = !isDebug;
    isDebug ? hideDebug() : showDebug();
  }
}

function hideDebug() {
  d3.select("#collisionSVG").style("visibility", "hidden");
  d3.select("#webgazerVideoCanvas").style("visibility", "hidden");
  d3.select("#webgazerFaceOverlay").style("visibility", "hidden");
  d3.select("#webgazerFaceFeedbackBox").style("visibility", "hidden");
  d3.select("#webgazerGazeDot").style("visibility", "hidden");
  d3.select("#webgazerVideoFeed").style("visibility", "hidden");
}

function showDebug() {
  d3.select("#collisionSVG").style("visibility", "visible");
  d3.select("#webgazerVideoCanvas").style("visibility", "visible");
  d3.select("#webgazerFaceOverlay").style("visibility", "visible");
  d3.select("#webgazerFaceFeedbackBox").style("visibility", "visible");
  d3.select("#webgazerGazeDot").style("visibility", "visible");
  d3.select("#webgazerVideoFeed").style("visibility", "visible");
}

//
// Classes
//

class CircleGenerator {
  constructor(centerX, centerY) {
    this.circles = []
    this.x = centerX;
    this.y = centerY;
    this.circlePhaseStart = random(0,1);
  }
  
  update(timePassedFromLastFrame, circleGrowthRatio, noiseZ) {
    for (let c of this.circles) {
      c.update(timePassedFromLastFrame, circleGrowthRatio, noiseZ);
    }

    this.circles = this.circles.filter(c => !c.shouldDispose());
  }

  draw() {
    for (let c of this.circles) {
      c.draw();
    }
  }

  generateNow() {
    this.circles.push(new Circle(this.x, this.y, this.circlePhaseStart));
  }

  getCircles() {
    return this.circles;
  }
}

class Circle {
  constructor(centerX, centerY, phaseStart) {
    this.centerX = centerX;
    this.centerY = centerY;
    
    // the circle will be drawn with random displacements, in area between circles with radius rMin and rMax
    this.rMin = 10;
    this.rMax = 200;

    this.phase = phaseStart;
    this.noiseZoff = 0.1;
    this.noiseMax = 4;

    this.points = [];

    this.color = color(40, 100, 100, 1000);
  }

  update(timePassedFromLastFrame, growthRatio, noiseZ) {
    const renderSpeedFactor = map(timePassedFromLastFrame, 15, 100, 1, 4);

    this.regeneratePoints();

    this.noiseZoff += noiseZ * renderSpeedFactor;
    this.phase += (o_phase * renderSpeedFactor) ** 2;
    this.noiseMax += o_noiseMax * renderSpeedFactor;

    this.rMin += growthRatio * renderSpeedFactor;
    this.rMax += growthRatio * renderSpeedFactor;
  }

  draw() {
    push();
    colorMode(HSB, 360, 100, 100, 1000);
    blendMode(ADD);
    strokeWeight(1);
    stroke(color(random(0, 360), random(80, 100), random(80, 100), this.color.levels[3]));
    noFill();
    //fill(10, 0, 100, 2);
    beginShape();
    for (const p of this.points) {
      vertex(p[0], p[1]);
    }
    endShape(CLOSE);
    pop();
  }

  regeneratePoints() {
    this.points = []
    noiseSeed(random()); // so every generator creates other circles

    // generate a circle of points, which are then displaced using noise, randomness, or some other data like biosensors
    for (let a = 0; a < TWO_PI; a += 0.35) {

      const xoff = map(cos(a+this.phase), -1, 1, 0, this.noiseMax);
      const yoff = map(sin(a+this.phase), -1, 1, 0, this.noiseMax);

      const r = map(noise(abs(this.centerX) + xoff, abs(this.centerY) + yoff, this.noiseZoff), 0, 1, this.rMin, this.rMax + random(o_extraRandomDisplacement));
      const x = r * cos(a);
      const y = r * sin(a);

      this.points.push([x + this.centerX, y + this.centerY]);
    }
  }

  setAlpha(alpha) {
    this.color.setAlpha(alpha);
  }

  getPoints() {
    return this.points;
  }

  /**
   * Call on every update from parent, to check if the circle became invisible so we can destroy it
   */
  shouldDispose() {
    return (this.color.levels[3] < 5) || (this.rMin > width / 2);
  }
}
