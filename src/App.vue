
<template>
  <!-- <img src="../src/assets/car.png" /> -->
  <canvas ref="canvas" id="drivingCars" width="1000" height="400" />
</template>

<script setup>
import {ref, onMounted} from 'vue';
import * as tf from '@tensorflow/tfjs';

const canvas = ref(null);

const keys = {
  'w': false,
  'a': false,
  's': false,
  'd': false,

  'arrowup': false,
  'arrowright': false,
  'arrowdown': false,
  'arrowleft': false,
}

const trackWidth = 120;
const trackBorderWidth = 10;

const carWidth = 40;
const carHeight = 20;
const carSpeed = 6;
const carAccelSpeed = 0.1;
const carTurnSpeed = 0.2;
const carTurnMax = 6;

const numCars = 100;
const numTimeSteps = 5; // Number of time steps to 
let trainingData = [];

const inputLength = 5; // Action input
const outputLength = 5; // Output with state etc.

const ticks = 1000;

let laps = 0;
let iterations = 0;

function rotateCoordinate(cx, cy, x, y, angleRadians) {
  const cos = Math.cos(angleRadians);
  const sin = Math.sin(angleRadians);
  const nx = (cos * (x - cx)) + (sin * (y - cy)) + cx;
  const ny = (cos * (y - cy)) - (sin * (x - cx)) + cy;
  return {x: nx, y: ny}
}

class Track {
  constructor(ctx, points, checkPoints){
    this.ctx = ctx;
    this.points = points;
    this.checkPoints = checkPoints;
  }
  draw(){
    // Border
    this.drawLines(this.ctx, this.points, trackWidth + trackBorderWidth * 2, "red", true)
    // Road
    this.drawLines(this.ctx, this.points, trackWidth, "grey")
    this.checkPoints.forEach(element => {
      this.drawCheckpoint(this.ctx, element.x, element.y, element.rotation, element.id)
    });
  }
  collide(x, y, width, height, rotation){
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.moveTo(this.points[0].x * trackWidth, this.points[0].y * trackWidth);
    for (let i = 1; i < this.points.length; i += 3){
      this.ctx.bezierCurveTo(
        this.points[i].x * trackWidth, this.points[i].y * trackWidth,
        this.points[i + 1].x * trackWidth, this.points[i + 1].y * trackWidth,
        this.points[i + 2].x * trackWidth, this.points[i + 2].y * trackWidth
      )
    }
    this.ctx.closePath();

    let x1 = x + 10;
    let y1 = y - height / 2 + 10;
    let x2 = x + width - 10;
    let y2 = y + height / 2 - 10;
    const coord = [
      {x: x1, y: y1},
      {x: x2, y: y1},
      {x: x2, y: y2},
      {x: x1, y: y2},
    ];

    // this.ctx.beginPath();
    // this.ctx.moveTo(x, y);
    // this.ctx.lineWidth = 2;
    // this.ctx.lineStyle = "red";

    let ded = false;

    coord.forEach(element => {
      // this.ctx.lineTo(element.x, element.y);
      // this.ctx.stroke();
      const ko = rotateCoordinate(x, y, element.x, element.y, -rotation);
      if (!this.ctx.isPointInStroke(ko.x, ko.y)) {
        ded = true;
        return;
      }
    });

    return ded;

  }
  collideCheckPoint(x, y){
    let id = 0;

    this.checkPoints.forEach(element => {
      this.ctx.save();
      this.ctx.translate(element.x * trackWidth, element.y * trackWidth);
      this.ctx.rotate(element.rotation);
      this.ctx.beginPath();
      this.ctx.moveTo(element.x, -trackWidth / 2);
      this.ctx.lineTo(element.x, trackWidth / 2);
      this.ctx.strokeStyle = "transparent";
      this.ctx.lineWidth = 1;
      this.ctx.stroke();
      this.ctx.closePath();

      this.ctx.restore();

      if (this.ctx.isPointInStroke(x, y)) {
        id = element.id;
        return;
      }

      this.ctx.restore();
    });

    return id;
  }

  drawCheckpoint(ctx, x, y, rotation, id){
    ctx.save();

    ctx.translate(x * trackWidth, y * trackWidth);
    ctx.rotate(rotation);

    ctx.beginPath();
    ctx.moveTo(x, -trackWidth / 2);
    ctx.lineTo(x, trackWidth / 2);
    ctx.strokeStyle = "green";
    if (id == 1) {
      ctx.strokeStyle = "lightgrey";
    }
    ctx.lineWidth = 10;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.closePath();

    ctx.restore();
  }
  drawLines(ctx, points, width, color, stroke = false){
    // Road
    ctx.beginPath();
    ctx.moveTo(points[0].x * trackWidth, points[0].y * trackWidth);

    for (let i = 1; i < points.length; i += 3){
      ctx.bezierCurveTo(
        points[i].x * trackWidth, points[i].y * trackWidth,
        points[i + 1].x * trackWidth, points[i + 1].y * trackWidth,
        points[i + 2].x * trackWidth, points[i + 2].y * trackWidth
      )
    }

    ctx.strokeStyle = color; // Road
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.closePath();

    if (stroke) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = width - 10;
      ctx.stroke();

      ctx.globalCompositeOperation = "source-over"; // restore default
    }
  }
}

class Car {
  constructor(ctx, x, y, width, height, speed, turnMax, direction, image){
    this.ctx = ctx;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.speed = speed;
    this.turnMax = turnMax;
    this.currentSpeed = 0;
    this.currentDirection = 0;
    this.direction = direction || 0;
    this.image = image;
    this.currentCheckPoint = 0;
    this.collectedCheckpoint = 0;
    this.crashed = false;
    this.reward;
    this.draw = this.draw.bind(this);
  }

  draw(){
    // Meta
    this.ctx.save();
    this.ctx.translate(this.x, this.y);
    this.ctx.rotate(this.direction);
    this.ctx.drawImage(this.image, 0, -this.height / 2, this.width, this.height);
    this.ctx.restore();
  }

  move(distance, reverse, track){

    if (this.crashed) {
      this.currentSpeed = 0;
      return;
    }

    if (reverse == null) {
      if (this.currentSpeed + distance > distance || this.currentSpeed - distance < -distance) { // Moving forwards
        distance = this.currentSpeed - distance < 0 ? distance : -distance;
      }
      else{
        distance = 0;
      }
    }

    if (reverse) {
      if (this.currentSpeed > 0) {
        this.currentSpeed -= distance * 2;
      }
      else{
        this.currentSpeed -= distance;
      }
    }
    else {
      this.currentSpeed += distance;
    }
    // Fix possible calculation errors
    this.currentSpeed = Math.round(this.currentSpeed * 10) / 10;
    if (this.currentSpeed > this.speed) {
      this.currentSpeed = this.speed;
    }
    else if(this.currentSpeed < -this.speed / 2){
      this.currentSpeed = -this.speed / 2;
    }
    
    if (this.currentSpeed > 0.1 || this.currentSpeed < -0.1) {
      this.direction += degrees_to_radians(this.currentDirection / this.speed * this.currentSpeed);
    }

    this.x += this.currentSpeed * Math.cos(this.direction)
    this.y += this.currentSpeed * Math.sin(this.direction)

    if (track.collide(this.x, this.y, this.width, this.height, this.direction)) {
      this.crashed = true;
      // window.location.reload();
    }
    const id = track.collideCheckPoint(this.x, this.y);
    if (id != 0){
      if (id == track.checkPoints[0].id && this.currentCheckPoint == track.checkPoints[track.checkPoints.length - 1].id) {
        this.currentCheckPoint = id;
        laps++;
      }
      else if (id - 1 == this.currentCheckPoint ){
        this.currentCheckPoint = id;
        // console.log(id);
      }
      else if(id != this.currentCheckPoint){
        // console.log("Wrong way");

        const checkpoint = track.checkPoints.find((element) => element.id == this.currentCheckPoint);
        this.reset(checkpoint.x, checkpoint.y, checkpoint.rotation);
      }
    }
  }
  rotate(deltaAngle, input = false){
    if (input) {
      this.currentDirection += deltaAngle;
      if (this.currentDirection > this.turnMax) {
        this.currentDirection = this.turnMax;
      } else if (this.currentDirection < -this.turnMax) {
        this.currentDirection = -this.turnMax;
      }
      this.currentDirection = Math.round(this.currentDirection * 10) / 10;
    }
    else{
      const directionAbs = Math.abs(this.currentDirection)
      const difference = Math.abs(directionAbs - deltaAngle);

      if (directionAbs <= difference || this.currentDirection == 0) { // If we are close enough to 0 but just past/before
        deltaAngle = 0;
        this.currentDirection = deltaAngle; // Set direction to 0
      }
      else if (this.currentDirection + deltaAngle >= deltaAngle) {
        deltaAngle = -deltaAngle;
      }
      else if(this.currentDirection - deltaAngle <= -deltaAngle){
        deltaAngle = deltaAngle;
      }

      if (deltaAngle != 0) {
        this.currentDirection += deltaAngle;
      }
      if (this.currentDirection != 0) {
        this.currentDirection = Math.round(this.currentDirection * 10) / 10;
      }
    }

    let newMax = (((this.speed * 1.15) - this.currentSpeed) / this.speed) * this.turnMax;
    newMax = Math.round(newMax * 10) / 10;
    if (this.currentDirection > newMax) {
      this.currentDirection = newMax;
    }
    else if(this.currentDirection < -newMax){
      this.currentDirection = -newMax;
    }
  }
  reset(x, y, rotation){
    this.x = x * trackWidth;
    this.y = y * trackWidth;
    this.direction = rotation;
    this.crashed = false;
    this.currentCheckPoint = 0;
  }
}

function degrees_to_radians(degrees)
{
  var pi = Math.PI;
  return degrees * (pi/180);
}

function getRandomAction(car) {
  // Antager at din handling er en vektor med 3 elementer
  let action = [];
  for (let i = 0; i < 5; i++) {
    // Tilføj en tilfældig værdi mellem -1 og 1 til handlingen
    if (i == 0) {
      action.push(car.x);
    }
    else if (i == 1) {
      action.push(car.y);
    }
    else{
      action.push(Math.random() * 2 - 1);
    }
  }
  return action;
}

function getActions(cars) {
  // const states = cars.map(car => getCleanedState(car));
  const states = cars.map(car => [car.x,car.x,0,0,0]);
  const xs = tf.tensor2d(states);
  const actions = model.predict(xs).arraySync();
  return actions;
}

function getState(car){
  return [car.x, car.y, car.currentSpeed, car.currentDirection, car.reward];
}
function getCleanedState(car){
  return [car.x, car.y, car.currentSpeed, car.currentDirection];
}

function collectData(car, action, track) {
  // Kør en runde
  for (let t = 0; t < numTimeSteps; t++) {
    // Få bilens nuværende tilstand

    // Define the reward
    let reward = 0;
    reward += (car.currentSpeed / car.speed * car.speed) * 10;
    if (car.currentCheckPoint == car.collectedCheckpoint + 1) { // replace with your condition
      car.collectedCheckpoint = car.currentCheckPoint;
      reward += 10;
    } else if (car.crashed) { // replace with your condition
      reward += -20;
    }
    
    car.reward = reward;
    let state = getState(car);

    // Gem tilstanden, handlingen, og reward i træningsdata
    trainingData.push({ state, action, reward });
  }  
}

let model;

function CreateModel(){
  let tempModel = tf.sequential();
  // const config = {units: 1, inputShape: [3]}
  // tempModel.add(tf.layers.dense(config)); // input shape is the size of the state
  tempModel.add(tf.layers.dense({ inputShape: [inputLength], units: 3 })); // input shape is the size of the state
  tempModel.add(tf.layers.dense({ units: 4}));
  tempModel.add(tf.layers.dense({ units: 5, activation: 'softmax' })); // output size is the size of the action
  // tempModel.compile({ loss: 'categoricalCrossentropy', optimizer: 'adam' });
  return tempModel
}

function UpdateModel(){
  model.add(tf.layers.dense({ inputShape: [3], units: 1 }));
}

async function TrainModel2(cars){
  
  model = CreateModel(cars);
  if (model == null) {
  }
  // model.compile({optimizer: 'sgd', loss: 'meanSquaredError'});
  model.compile({ loss: 'categoricalCrossentropy', optimizer: 'adam' });

  const {xs, ys} = convertToTensor(trainingData)
  
  await model.fit(xs, ys, { epochs: 10, batchSize: numCars }).then(() => {
    xs.dispose();
    ys.dispose();
    trainingData = [];
  });
}

function convertToTensor(trainingData) {
  return tf.tidy(() => {
    let xs, ys;

    let actionData = [];
    let stateData = [];

    for (let i = 0; i < trainingData.length; i++) {
      let data = trainingData[i];
      actionData.push(data.action);
      stateData.push(data.state);
    }

    // console.log(actionData)
    // console.log(stateData)
    
    xs = tf.tensor2d(actionData, [actionData.length, inputLength]);
    ys = tf.tensor2d(stateData, [stateData.length, outputLength]);

    const xsMax = xs.max();
    const xsMin = xs.min();
    const ysMax = ys.max();
    const ysMin = ys.min();

    const normalizedXs = xs.sub(xsMin).div(xsMax.sub(xsMin));
    const normalizedYs = ys.sub(ysMin).div(ysMax.sub(ysMin))
    
    return {
      xs: normalizedXs,
      ys: normalizedYs,
    }
  });
}

let absoluteTicks = 0;

onMounted(() => {
  const canvasElement = canvas.value;
  canvasElement.width = window.innerWidth - 20;
  canvasElement.height = window.innerHeight - 20;

  const ctx = canvasElement.getContext('2d');
  if (!ctx) {
    console.log('Unable to get Canvas Context');
    return;
  }

  const trackPoints = [
    {x: 3, y: 1},
  
    {x: 4, y: 1},
    {x: 5, y: 1},
    {x: 6, y: 1},
  
    {x: 7, y: 1},
    {x: 8, y: 1},
    {x: 9, y: 2},
    
    {x: 10, y: 3},
    {x: 11, y: 3},
    {x: 12, y: 3},
    
    {x: 12, y: 3},
    {x: 13, y: 3},
    {x: 13, y: 2},
    
    {x: 13, y: 1},
    {x: 14, y: 1},
    {x: 14, y: 1},
    
    {x: 15, y: 1},
    {x: 16, y: 1},
    {x: 17, y: 1},
    
    {x: 17, y: 1},
    {x: 18, y: 1},
    {x: 18, y: 2},
    
    {x: 18, y: 3},
    {x: 18, y: 5},
    {x: 18, y: 6},
    
    {x: 18, y: 6},
    {x: 18, y: 8},
    {x: 16, y: 8},
    
    {x: 15, y: 8},
    {x: 14, y: 8},
    {x: 13, y: 8},
    
    {x: 13, y: 8},
    {x: 11, y: 8},
    {x: 11, y: 6},
    
    {x: 11, y: 6},
    {x: 11, y: 5},
    {x: 10, y: 5},
    
    {x: 9, y: 5},
    {x: 8, y: 5},
    {x: 7, y: 5},
    
    {x: 7, y: 5},
    {x: 6, y: 5},
    {x: 5, y: 6},
    
    {x: 4, y: 7},
    {x: 4, y: 8},
    {x: 3, y: 8},
    
    {x: 3, y: 8},
    {x: 1, y: 8},
    {x: 1, y: 6},
    
    {x: 1, y: 6},
    {x: 1, y: 5},
    {x: 1, y: 3},
    
    {x: 1, y: 2},
    {x: 1, y: 1},
    {x: 3, y: 1},
  ];

  const checkPoints = [
    {id: 1, x: 4, y: 1, rotation: degrees_to_radians(0)},
    {id: 2, x: 6, y: 1, rotation: degrees_to_radians(0)},
    {id: 3, x: 9, y: 2, rotation: degrees_to_radians(45)},
    {id: 4, x: 13, y: 2, rotation: degrees_to_radians(-90)},
    {id: 5, x: 16, y: 1, rotation: degrees_to_radians(0)},
    {id: 6, x: 18, y: 2, rotation: degrees_to_radians(90)},
    {id: 7, x: 18, y: 6, rotation: degrees_to_radians(90)},
    {id: 8, x: 15, y: 8, rotation: degrees_to_radians(180)},
    {id: 9, x: 11, y: 6, rotation: degrees_to_radians(-90)},
    {id: 10, x: 8, y: 5, rotation: degrees_to_radians(180)},
    {id: 11, x: 5, y: 6, rotation: degrees_to_radians(-45)},
    {id: 12, x: 2, y: 7.75, rotation: degrees_to_radians(200)},
    {id: 13, x: 1, y: 3, rotation: degrees_to_radians(270)},
  ]
  
  const track = new Track(ctx, trackPoints, checkPoints);

  let img = new Image();
  img.onload = function() {
    console.log("KO");
  };
  img.src = '../src/assets/car1.png';
  
  const startPos = track.checkPoints[0];
  const playerCar = new Car(ctx, startPos.x * trackWidth, startPos.y * trackWidth, carWidth, carHeight, carSpeed, carTurnMax, 0, img);

  let cars = [];
  for (let i = 0; i < numCars; i++) {
    cars.push(new Car(ctx, (startPos.x - 1) * trackWidth, startPos.y * trackWidth, carWidth, carHeight, carSpeed, carTurnMax, 0, img));
  }
  
  track.draw();
  playerCar.draw();
  
  async function gameLoop(){
    ctx.clearRect(0,0, canvasElement.width, canvasElement.height);
    track.draw();
    
    //#region player car inputs
    if (keys['w'] || keys['s']) {
      playerCar.move(carAccelSpeed, keys['w'] ? false : true, track);
    }
    else if (keys['arrowup'] || keys['arrowdown']) {
      playerCar.move(carAccelSpeed, keys['arrowup'] ? false : true, track);
    }
    else{ // Auto Breaking
      playerCar.move(carAccelSpeed, null, track)
    }

    if (keys['a'] || keys['d']) {
      playerCar.rotate(keys['a'] ? -carTurnSpeed : carTurnSpeed, true);
    }
    else if (keys['arrowleft'] || keys['arrowright']) {
      playerCar.rotate(keys['arrowleft'] ? -carTurnSpeed : carTurnSpeed, true);
    }
    else{
      playerCar.rotate(carTurnSpeed * 4);
    }
    //#endregion

    //#region Visual text output 
    let points = laps * 200 + (playerCar.currentCheckPoint - 1) * 10;
    if (playerCar.currentCheckPoint == 0) {
      points = laps * 200;
    }
    ctx.font = "bold 48px Courier";
    ctx.fillStyle = 'Red';
    ctx.fontWeight = 'bolder';
    ctx.fillText("Laps: " + laps, 300, 300);
    ctx.fillText("Points: " + points, 300, 350);
    ctx.fillText("TrainingData: " + trainingData.length, 300, 400);
    ctx.fillText("Iterations: " + iterations, 300, 450);
    //#endregion

    let actions;
    if (model) { // If model has been created
      // actions = cars.map(() => getRandomAction());
      // console.log('Calulated Model!!!!')
      actions = getActions(cars);
    } else {
      actions = cars.map(car => getRandomAction(car));
    }

    // Collect data
    if (absoluteTicks % numCars == 1) {
      cars.forEach((car, i) => {
        collectData(car, actions[i], track);
      });
    }

    // Train the model if enough data has been collected
    if (trainingData.length >= ticks) {
      await TrainModel2(cars)
      // UpdateModel()
      console.log(model.summary())

      console.log('Done Training');
      iterations++

      const checkpoint = track.checkPoints[0];
      for (let i = 0; i < cars.length; i++) {
        cars[i].reset(checkpoint.x - 1, checkpoint.y, checkpoint.rotation);
      }
    }

    cars.forEach((car, i) => {
      const action = actions[i];
      if (action[0] > 0) { // Apply the actions to the car
        car.move(carAccelSpeed, false, track);
      }
      else{ // Auto Breaking
        car.move(carAccelSpeed, null, track)
      }

      if (action[1] > 0) {
        car.rotate(-carTurnSpeed, true);
      }
      if (action[2] > 0) {
        car.rotate(carTurnSpeed, true);
      }
      car.draw();
    });

    absoluteTicks++;
    playerCar.draw();
    requestAnimationFrame(gameLoop)
  }

  gameLoop();
})


window.addEventListener('keydown', (event) => {
  keys[event.key.toLocaleLowerCase()] = true;
})
window.addEventListener('keyup', (event) => {
  keys[event.key.toLocaleLowerCase()] = false;
})
</script>