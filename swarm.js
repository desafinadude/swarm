let url= new URL(document.URL);
let params = new URLSearchParams(url.search);

if(params.get('v') == '2') {

  var Vector = function(x, y) {
    if(x === 'undefined') x = 0;
    if(y === 'undefined') y = 0;
    this.x = x;
    this.y = y;
  };
  
  Vector.prototype.add = function(v) {
    return new Vector(this.x + v.x, this.y + v.y);
  };
  Vector.prototype.sub = function(v) {
    return new Vector(this.x - v.x, this.y - v.y);
  };
  Vector.prototype.mul = function(v) {
    return new Vector(this.x * v.x, this.y * v.y);
  };
  Vector.prototype.div = function(v) {
    return new Vector(this.x / v.x, this.y / v.y);
  };
  Vector.prototype.mag = function() {
    return Math.sqrt((this.x * this.x) + (this.y * this.y));
  };
  Vector.prototype.normalise = function(v) {
    var mag = this.mag();
    return new Vector(this.x / mag, this.y / mag);
  };
  Vector.prototype.dist = function(v) {
    return Math.sqrt((this.x - v.x)*(this.x - v.x) + (this.y - v.y)*(this.y - v.y));
  };
  Vector.prototype.limit = function(limit) {
    var v;
    if(this.mag() > limit) {
      v = this.normalise().mul(new Vector(limit, limit));
    } else {
      v = this;
    }
    return v;
  };
  
  // INDIVIDUAL BOID CLASS
  var Boid = function(parent, position, velocity, size, colour) {
    // Initialise the boid parameters
    this.position = new Vector(position.x, position.y);
    this.velocity = new Vector(velocity.x, velocity.y);
    this.acceleration = new Vector(0, 0);
  
    // Check if valid colour
    if (!(/(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i).test(colour)) {
      console.error('Please specify a valid boid hexadecimal color');
      return false;
    }
    this.size = size;
    this.colour = colour;
    this.parent = parent;
  };
  
  Boid.prototype.draw = function () {
    // Draw boid
  
    this.parent.ctx.beginPath();
    this.parent.ctx.fillStyle = this.colour;
    this.parent.ctx.globalAlpha = 0.7;
    // this.parent.ctx.arc(this.position.x, this.position.y, this.parent.boidRadius * this.size, 0, 2 * Math.PI);
    this.parent.ctx.moveTo(this.position.x, this.position.y);
    this.parent.ctx.lineTo(this.position.x - (this.size * 5), this.position.y + (this.size * 10));
    this.parent.ctx.lineTo(this.position.x + (this.size * 5), this.position.y + (this.size * 10));
    this.parent.ctx.closePath();
    this.parent.ctx.fill();
  };
  
  /* Update the boid positions according to Reynold's rules.
  ** Called on every frame  */
  Boid.prototype.update = function () {
    var v1 = this.cohesion();
    var v2 = this.separation();
    var v3 = this.alignment();
    var v4 = this.interactivity();
  
    // Weight rules to get best behaviour
    v1 = v1.mul(new Vector(1, 1));
    v2 = v2.mul(new Vector(1.5, 1.5));
    v3 = v3.mul(new Vector(1, 1));
    v4 = v4.mul(new Vector(4, 4));
  
    this.applyForce(v1);
    this.applyForce(v2);
    this.applyForce(v3);
    this.applyForce(v4);
  
    this.velocity = this.velocity.add(this.acceleration);
    this.velocity = this.velocity.limit(this.parent.options.speed);
  
    this.position = this.position.add(this.velocity);
    this.acceleration = this.acceleration.mul(new Vector(0, 0));
    this.borders();
  };
  
  // BOIDS FLOCKING RULES
  
  /* Cohesion rule: steer towards average position of local flockmates */
  Boid.prototype.cohesion = function () {
    var sum = new Vector(0, 0); // Average flockmate position
    var count = 0;  // number of local flockmates
  
    // For each boid close enough to be seen...
    for(var i = 0; i < this.parent.boids.length; i++) {
      var d = this.position.dist(this.parent.boids[i].position);
      if(d > 0 && d < this.parent.visibleRadius) {
        sum = sum.add(this.parent.boids[i].position);
        count++;
      }
    }
  
    if(count > 0) {
      // Calculate average position and return the force required to steer towards it
      sum = sum.div(new Vector(count, count));
      sum = this.seek(sum);
      return sum;
    } else {
      return new Vector(0, 0);
    }
  };
  
  /* Separation rule: steer to avoid crowding local flockmates */
  Boid.prototype.separation = function () {
    var steer = new Vector(0, 0); // Average steer
    var count = 0;  // number of flockmates considered "too close"
  
    // For each boid which is too close, calculate a vector pointing
    // away from it weighted by the distance to it
    for(var i = 0; i < this.parent.boids.length; i++) {
      var d = this.position.dist(this.parent.boids[i].position) - (this.size * this.parent.boidRadius);
      if(d > 0 && d < this.parent.separationDist) {
        var diff = this.position.sub(this.parent.boids[i].position);
        diff = diff.normalise();
        diff = diff.div(new Vector(d, d));
        steer = steer.add(diff);
        count++;
      }
    }
    // Calculate average
    if(count > 0) {
      steer = steer.div(new Vector(count, count));
    }
  
    // Steering = Desired - Velocity
    if(steer.mag() > 0) {
      steer = steer.normalise();
      steer = steer.mul(new Vector(this.parent.options.speed, this.parent.options.speed));
      steer = steer.sub(this.velocity);
      steer = steer.limit(this.parent.maxForce);
    }
    return steer;
  };
  
  /* Alignment rule: steer toward average heading of local flockmates */
  Boid.prototype.alignment = function () {
    var sum = new Vector(0, 0); // Average velocity
    var count = 0;  // number of local flockmates
  
    // For each boid which is close enough to be seen
    for(var i = 0; i < this.parent.boids.length; i++) {
      var d = this.position.dist(this.parent.boids[i].position);
      if(d > 0 && d < this.parent.visibleRadius) {
        sum = sum.add(this.parent.boids[i].velocity);
        count++;
      }
    }
  
    if(count > 0) {
      // Calculate average and limit
      sum = sum.div(new Vector(count, count));
      sum = sum.normalise();
      sum = sum.mul(new Vector(this.parent.options.speed, this.parent.options.speed));
  
      // Steering = Desired - Velocity
      var steer = sum.sub(this.velocity);
      steer = steer.limit(this.parent.maxForce);
      return steer;
    } else {
      return new Vector(0, 0);
    }
  };
  
  Boid.prototype.interactivity = function () {
    if(this.parent.options.interactive && this.parent.mousePos !== undefined &&
       this.position.dist(this.parent.mousePos) < this.parent.visibleRadius) {
      return this.seek(this.parent.mousePos);
    } else {
      return new Vector(0, 0);
    }
  };
  
  // Implement torus boundaries
  Boid.prototype.borders = function() {
    if(this.position.x < 0) this.position.x = this.parent.canvas.width;
    if(this.position.y < 0) this.position.y = this.parent.canvas.height;
    if(this.position.x > this.parent.canvas.width) this.position.x = 0;
    if(this.position.y > this.parent.canvas.height) this.position.y = 0;
  };
  
  /* Calculate a force to apply to a boid to steer
  ** it towards a target position */
  Boid.prototype.seek = function(target) {
    var desired = target.sub(this.position);
    desired = desired.normalise();
    desired = desired.mul(new Vector(this.parent.options.speed, this.parent.options.speed));
  
    var steer = desired.sub(this.velocity);
    steer = steer.limit(this.parent.maxForce);
    return steer;
  };
  
  // Adjust the acceleration by applying a force, using A = F / M
  // with M = boid size so that larger boids have more inertia
  Boid.prototype.applyForce = function(force) {
    this.acceleration = this.acceleration.add(force.div(new Vector(this.size, this.size)));
  };
  
  // BOIDS CANVAS CLASS
  var BoidsCanvas = function(canvas, options) {
    this.canvasDiv = canvas;
    this.canvasDiv.size = {
      'width': this.canvasDiv.offsetWidth,
      'height': this.canvasDiv.offsetHeight
    };
  
    // Set customisable boids parameters
    options = options !== undefined ? options : {};
    this.options = {
      background: (options.background !== undefined) ? options.background : '#1a252f',
      density: this.setDensity(options.density),
      speed: this.setSpeed(options.speed),
      interactive: (options.interactive !== undefined) ? options.interactive : true,
      mixedSizes: (options.mixedSizes !== undefined) ? options.mixedSizes : true,
      boidColours: (options.boidColours !== undefined && options.boidColours.length !== 0) ? options.boidColours : ["#ff3333"]
    };
  
    // Internal boids parameters
    this.visibleRadius = 150;
    this.maxForce = 0.04;
    this.separationDist = 80;
    this.boidRadius = 5;  //size of the smallest boid
  
    this.init();
  };
  
  BoidsCanvas.prototype.init = function() {
  
    // Create background div
    this.bgDiv = document.createElement('div');
    this.canvasDiv.appendChild(this.bgDiv);
    this.setStyles(this.bgDiv, {
      'position': 'absolute',
      'top': 0,
      'left': 0,
      'bottom': 0,
      'right': 0,
      'z-index': 1
    });
  
    // Check if valid background hex color
    if ((/(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i).test(this.options.background)) {
      this.setStyles(this.bgDiv, {
        'background': this.options.background
      });
    }
    // Else check if valid image
    else if ((/\.(gif|jpg|jpeg|tiff|png)$/i).test(this.options.background)) {
      this.setStyles(this.bgDiv, {
        'background': 'url("' + this.options.background + '") no-repeat center',
        'background-size': 'cover'
      });
    }
    // Else throw error
    else {
      console.error('Please specify a valid background image or hexadecimal color');
      return false;
    }
  
    // Create canvas & context
    this.canvas = document.createElement('canvas');
    this.canvasDiv.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.canvas.width = this.canvasDiv.size.width;
    this.canvas.height = this.canvasDiv.size.height;
    this.setStyles(this.canvasDiv, { 'position': 'relative' });
    this.setStyles(this.canvas, {
      'z-index': '20',
      'position': 'relative'
    });
  
    // Add resize listener to canvas
    window.addEventListener('resize', function () {
      // Check if div has changed size
      if (this.canvasDiv.offsetWidth === this.canvasDiv.size.width && this.canvasDiv.offsetHeight === this.canvasDiv.size.height) {
        return false;
      }
  
      // Scale canvas
      this.canvas.width = this.canvasDiv.size.width = this.canvasDiv.offsetWidth;
      this.canvas.height = this.canvasDiv.size.height = this.canvasDiv.offsetHeight;
  
      this.initialiseBoids();
    }.bind(this));
  
    this.initialiseBoids();
  
    // Mouse event listeners
    this.canvas.addEventListener('mousemove', function (e) {
      this.mousePos = new Vector(e.clientX - this.canvas.offsetLeft,
                                 e.clientY - this.canvas.offsetTop);
    }.bind(this));
    this.canvas.addEventListener('mouseleave', function (e) {
      this.mousePos = undefined;
    }.bind(this));
  
    // Update canvas
    requestAnimationFrame(this.update.bind(this));
  };
  
  // Initialise boids according to options
  BoidsCanvas.prototype.initialiseBoids = function() {
    this.boids = [];
    for(var i = 0; i < this.canvas.width * this.canvas.height / this.options.density; i++) {
      var position = new Vector(Math.floor(Math.random()*(this.canvas.width+1)),
                                Math.floor(Math.random()*(this.canvas.height+1)));
      var max_velocity = 5;
      var min_velocity = -5;
      var velocity = new Vector(Math.floor(Math.random()*(max_velocity-min_velocity+1)+min_velocity),
                                Math.floor(Math.random()*(max_velocity-min_velocity+1)+min_velocity));
      var size = (this.options.mixedSizes) ? Math.floor(Math.random()*(3-1+1)+1) : 1;
      var colourIdx = Math.floor(Math.random()*(this.options.boidColours.length-1+1));
      this.boids.push(new Boid(this, position, velocity, size, this.options.boidColours[colourIdx]));
    }
  };
  
  BoidsCanvas.prototype.update = function() {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.globalAlpha = 1;
  
    // Update and draw boids
    for (var i = 0; i < this.boids.length; i++) {
      this.boids[i].update();
      this.boids[i].draw();
    }
  
    // Request next frame
    requestAnimationFrame(this.update.bind(this));
  };
  
  // Helper method to set density multiplier
  BoidsCanvas.prototype.setSpeed = function (speed) {
    if (speed === 'fast') {
      return 3;
    }
    else if (speed === 'slow') {
      return 1;
    }
    return 2;
  };
  
  // Helper method to set density multiplier
  BoidsCanvas.prototype.setDensity = function (density) {
    if (density === 'high') {
      return 5000;
    }
    else if (density === 'low') {
      return 20000;
    }
    return 10000;
  };
  
  // Helper method to set multiple styles
  BoidsCanvas.prototype.setStyles = function (div, styles) {
    for (var property in styles) {
      div.style[property] = styles[property];
    }
  };


  var canvasDiv = document.getElementById('swarm');
  var options = {
    background: '#fff',
    density: 'low',
    speed: 'fast',
    interactive: true,
    mixedSizes: true,
    boidColours: ["#005450"]
  };
  var boidsCanvas = new BoidsCanvas(canvasDiv, options);
  







} else {

  /* -----------------------------------------------
  /* Author : Vincent Garreau  - vincentgarreau.com
  /* MIT license: http://opensource.org/licenses/MIT
  /* Demo / Generator : vincentgarreau.com/particles.js
  /* GitHub : github.com/VincentGarreau/particles.js
  /* How to use? : Check the GitHub README
  /* v2.0.0
  /* ----------------------------------------------- */


  var pJS = function(tag_id, params){

      var canvas_el = document.querySelector('#'+tag_id+' > .particles-js-canvas-el');
    
      /* particles.js variables with default values */
      this.pJS = {
        canvas: {
          el: canvas_el,
          w: canvas_el.offsetWidth,
          h: canvas_el.offsetHeight
        },
        particles: {
          number: {
            value: 400,
            density: {
              enable: true,
              value_area: 800
            }
          },
          color: {
            value: '#fff'
          },
          shape: {
            type: 'circle',
            stroke: {
              width: 0,
              color: '#ff0000'
            },
            polygon: {
              nb_sides: 5
            },
            image: {
              src: '',
              width: 100,
              height: 100
            }
          },
          opacity: {
            value: 1,
            random: false,
            anim: {
              enable: false,
              speed: 2,
              opacity_min: 0,
              sync: false
            }
          },
          size: {
            value: 20,
            random: false,
            anim: {
              enable: false,
              speed: 20,
              size_min: 0,
              sync: false
            }
          },
          line_linked: {
            enable: true,
            distance: 100,
            color: '#fff',
            opacity: 1,
            width: 1
          },
          move: {
            enable: true,
            speed: 2,
            direction: 'none',
            random: false,
            straight: false,
            out_mode: 'out',
            bounce: false,
            attract: {
              enable: false,
              rotateX: 3000,
              rotateY: 3000
            }
          },
          array: []
        },
        interactivity: {
          detect_on: 'canvas',
          events: {
            onhover: {
              enable: true,
              mode: 'grab'
            },
            onclick: {
              enable: true,
              mode: 'push'
            },
            resize: true
          },
          modes: {
            grab:{
              distance: 100,
              line_linked:{
                opacity: 1
              }
            },
            bubble:{
              distance: 200,
              size: 80,
              duration: 0.4
            },
            repulse:{
              distance: 200,
              duration: 0.4
            },
            push:{
              particles_nb: 4
            },
            remove:{
              particles_nb: 2
            }
          },
          mouse:{}
        },
        retina_detect: false,
        fn: {
          interact: {},
          modes: {},
          vendors:{}
        },
        tmp: {}
      };
    
      var pJS = this.pJS;
    
      /* params settings */
      if(params){
        Object.deepExtend(pJS, params);
      }
    
      pJS.tmp.obj = {
        size_value: pJS.particles.size.value,
        size_anim_speed: pJS.particles.size.anim.speed,
        move_speed: pJS.particles.move.speed,
        line_linked_distance: pJS.particles.line_linked.distance,
        line_linked_width: pJS.particles.line_linked.width,
        mode_grab_distance: pJS.interactivity.modes.grab.distance,
        mode_bubble_distance: pJS.interactivity.modes.bubble.distance,
        mode_bubble_size: pJS.interactivity.modes.bubble.size,
        mode_repulse_distance: pJS.interactivity.modes.repulse.distance
      };
    
    
      pJS.fn.retinaInit = function(){
    
        if(pJS.retina_detect && window.devicePixelRatio > 1){
          pJS.canvas.pxratio = window.devicePixelRatio; 
          pJS.tmp.retina = true;
        } 
        else{
          pJS.canvas.pxratio = 1;
          pJS.tmp.retina = false;
        }
    
        pJS.canvas.w = pJS.canvas.el.offsetWidth * pJS.canvas.pxratio;
        pJS.canvas.h = pJS.canvas.el.offsetHeight * pJS.canvas.pxratio;
    
        pJS.particles.size.value = pJS.tmp.obj.size_value * pJS.canvas.pxratio;
        pJS.particles.size.anim.speed = pJS.tmp.obj.size_anim_speed * pJS.canvas.pxratio;
        pJS.particles.move.speed = pJS.tmp.obj.move_speed * pJS.canvas.pxratio;
        pJS.particles.line_linked.distance = pJS.tmp.obj.line_linked_distance * pJS.canvas.pxratio;
        pJS.interactivity.modes.grab.distance = pJS.tmp.obj.mode_grab_distance * pJS.canvas.pxratio;
        pJS.interactivity.modes.bubble.distance = pJS.tmp.obj.mode_bubble_distance * pJS.canvas.pxratio;
        pJS.particles.line_linked.width = pJS.tmp.obj.line_linked_width * pJS.canvas.pxratio;
        pJS.interactivity.modes.bubble.size = pJS.tmp.obj.mode_bubble_size * pJS.canvas.pxratio;
        pJS.interactivity.modes.repulse.distance = pJS.tmp.obj.mode_repulse_distance * pJS.canvas.pxratio;
    
      };
    
    
    
      /* ---------- pJS functions - canvas ------------ */
    
      pJS.fn.canvasInit = function(){
        pJS.canvas.ctx = pJS.canvas.el.getContext('2d');
      };
    
      pJS.fn.canvasSize = function(){
    
        pJS.canvas.el.width = pJS.canvas.w;
        pJS.canvas.el.height = pJS.canvas.h;
    
        if(pJS && pJS.interactivity.events.resize){
    
          window.addEventListener('resize', function(){
    
              pJS.canvas.w = pJS.canvas.el.offsetWidth;
              pJS.canvas.h = pJS.canvas.el.offsetHeight;
    
              /* resize canvas */
              if(pJS.tmp.retina){
                pJS.canvas.w *= pJS.canvas.pxratio;
                pJS.canvas.h *= pJS.canvas.pxratio;
              }
    
              pJS.canvas.el.width = pJS.canvas.w;
              pJS.canvas.el.height = pJS.canvas.h;
    
              /* repaint canvas on anim disabled */
              if(!pJS.particles.move.enable){
                pJS.fn.particlesEmpty();
                pJS.fn.particlesCreate();
                pJS.fn.particlesDraw();
                pJS.fn.vendors.densityAutoParticles();
              }
    
            /* density particles enabled */
            pJS.fn.vendors.densityAutoParticles();
    
          });
    
        }
    
      };
    
    
      pJS.fn.canvasPaint = function(){
        pJS.canvas.ctx.fillRect(0, 0, pJS.canvas.w, pJS.canvas.h);
      };
    
      pJS.fn.canvasClear = function(){
        pJS.canvas.ctx.clearRect(0, 0, pJS.canvas.w, pJS.canvas.h);
      };
    
    
      /* --------- pJS functions - particles ----------- */
    
      pJS.fn.particle = function(color, opacity, position){
    
        /* size */
        this.radius = (pJS.particles.size.random ? Math.random() : 1) * pJS.particles.size.value;
        if(pJS.particles.size.anim.enable){
          this.size_status = false;
          this.vs = pJS.particles.size.anim.speed / 100;
          if(!pJS.particles.size.anim.sync){
            this.vs = this.vs * Math.random();
          }
        }
    
        /* position */
        this.x = position ? position.x : Math.random() * pJS.canvas.w;
        this.y = position ? position.y : Math.random() * pJS.canvas.h;
    
        /* check position  - into the canvas */
        if(this.x > pJS.canvas.w - this.radius*2) this.x = this.x - this.radius;
        else if(this.x < this.radius*2) this.x = this.x + this.radius;
        if(this.y > pJS.canvas.h - this.radius*2) this.y = this.y - this.radius;
        else if(this.y < this.radius*2) this.y = this.y + this.radius;
    
        /* check position - avoid overlap */
        if(pJS.particles.move.bounce){
          pJS.fn.vendors.checkOverlap(this, position);
        }
    
        /* color */
        this.color = {};
        if(typeof(color.value) == 'object'){
    
          if(color.value instanceof Array){
            var color_selected = color.value[Math.floor(Math.random() * pJS.particles.color.value.length)];
            this.color.rgb = hexToRgb(color_selected);
          }else{
            if(color.value.r != undefined && color.value.g != undefined && color.value.b != undefined){
              this.color.rgb = {
                r: color.value.r,
                g: color.value.g,
                b: color.value.b
              }
            }
            if(color.value.h != undefined && color.value.s != undefined && color.value.l != undefined){
              this.color.hsl = {
                h: color.value.h,
                s: color.value.s,
                l: color.value.l
              }
            }
          }
    
        }
        else if(color.value == 'random'){
          this.color.rgb = {
            r: (Math.floor(Math.random() * (255 - 0 + 1)) + 0),
            g: (Math.floor(Math.random() * (255 - 0 + 1)) + 0),
            b: (Math.floor(Math.random() * (255 - 0 + 1)) + 0)
          }
        }
        else if(typeof(color.value) == 'string'){
          this.color = color;
          this.color.rgb = hexToRgb(this.color.value);
        }
    
        /* opacity */
        this.opacity = (pJS.particles.opacity.random ? Math.random() : 1) * pJS.particles.opacity.value;
        if(pJS.particles.opacity.anim.enable){
          this.opacity_status = false;
          this.vo = pJS.particles.opacity.anim.speed / 100;
          if(!pJS.particles.opacity.anim.sync){
            this.vo = this.vo * Math.random();
          }
        }
    
        /* animation - velocity for speed */
        var velbase = {}
        switch(pJS.particles.move.direction){
          case 'top':
            velbase = { x:0, y:-1 };
          break;
          case 'top-right':
            velbase = { x:0.5, y:-0.5 };
          break;
          case 'right':
            velbase = { x:1, y:-0 };
          break;
          case 'bottom-right':
            velbase = { x:0.5, y:0.5 };
          break;
          case 'bottom':
            velbase = { x:0, y:1 };
          break;
          case 'bottom-left':
            velbase = { x:-0.5, y:1 };
          break;
          case 'left':
            velbase = { x:-1, y:0 };
          break;
          case 'top-left':
            velbase = { x:-0.5, y:-0.5 };
          break;
          default:
            velbase = { x:0, y:0 };
          break;
        }
    
        if(pJS.particles.move.straight){
          this.vx = velbase.x;
          this.vy = velbase.y;
          if(pJS.particles.move.random){
            this.vx = this.vx * (Math.random());
            this.vy = this.vy * (Math.random());
          }
        }else{
          this.vx = velbase.x + Math.random()-0.5;
          this.vy = velbase.y + Math.random()-0.5;
        }
    
        // var theta = 2.0 * Math.PI * Math.random();
        // this.vx = Math.cos(theta);
        // this.vy = Math.sin(theta);
    
        this.vx_i = this.vx;
        this.vy_i = this.vy;
    
        
    
        /* if shape is image */
    
        var shape_type = pJS.particles.shape.type;
        if(typeof(shape_type) == 'object'){
          if(shape_type instanceof Array){
            var shape_selected = shape_type[Math.floor(Math.random() * shape_type.length)];
            this.shape = shape_selected;
          }
        }else{
          this.shape = shape_type;
        }
    
        if(this.shape == 'image'){
          var sh = pJS.particles.shape;
          this.img = {
            src: sh.image.src,
            ratio: sh.image.width / sh.image.height
          }
          if(!this.img.ratio) this.img.ratio = 1;
          if(pJS.tmp.img_type == 'svg' && pJS.tmp.source_svg != undefined){
            pJS.fn.vendors.createSvgImg(this);
            if(pJS.tmp.pushing){
              this.img.loaded = false;
            }
          }
        }
    
        
    
      };
    
    
      pJS.fn.particle.prototype.draw = function() {
    
        var p = this;
    
        if(p.radius_bubble != undefined){
          var radius = p.radius_bubble; 
        }else{
          var radius = p.radius;
        }
    
        if(p.opacity_bubble != undefined){
          var opacity = p.opacity_bubble;
        }else{
          var opacity = p.opacity;
        }
    
        if(p.color.rgb){
          var color_value = 'rgba('+p.color.rgb.r+','+p.color.rgb.g+','+p.color.rgb.b+','+opacity+')';
        }else{
          var color_value = 'hsla('+p.color.hsl.h+','+p.color.hsl.s+'%,'+p.color.hsl.l+'%,'+opacity+')';
        }
    
        pJS.canvas.ctx.fillStyle = color_value;
        pJS.canvas.ctx.beginPath();
    
        switch(p.shape){
    
          case 'circle':
            pJS.canvas.ctx.arc(p.x, p.y, radius, 0, Math.PI * 2, false);
          break;
    
          case 'edge':
            pJS.canvas.ctx.rect(p.x-radius, p.y-radius, radius*2, radius*2);
          break;
    
          case 'triangle':
            pJS.fn.vendors.drawShape(pJS.canvas.ctx, p.x-radius, p.y+radius / 1.66, radius*2, 3, 2);
          break;
    
          case 'polygon':
            pJS.fn.vendors.drawShape(
              pJS.canvas.ctx,
              p.x - radius / (pJS.particles.shape.polygon.nb_sides/3.5), // startX
              p.y - radius / (2.66/3.5), // startY
              radius*2.66 / (pJS.particles.shape.polygon.nb_sides/3), // sideLength
              pJS.particles.shape.polygon.nb_sides, // sideCountNumerator
              1 // sideCountDenominator
            );
          break;
    
          case 'star':
            pJS.fn.vendors.drawShape(
              pJS.canvas.ctx,
              p.x - radius*2 / (pJS.particles.shape.polygon.nb_sides/4), // startX
              p.y - radius / (2*2.66/3.5), // startY
              radius*2*2.66 / (pJS.particles.shape.polygon.nb_sides/3), // sideLength
              pJS.particles.shape.polygon.nb_sides, // sideCountNumerator
              2 // sideCountDenominator
            );
          break;
    
          case 'image':
    
            function draw(){
              pJS.canvas.ctx.drawImage(
                img_obj,
                p.x-radius,
                p.y-radius,
                radius*2,
                radius*2 / p.img.ratio
              );
            }
    
            if(pJS.tmp.img_type == 'svg'){
              var img_obj = p.img.obj;
            }else{
              var img_obj = pJS.tmp.img_obj;
            }
    
            if(img_obj){
              draw();
            }
    
          break;
    
        }
    
        pJS.canvas.ctx.closePath();
    
        if(pJS.particles.shape.stroke.width > 0){
          pJS.canvas.ctx.strokeStyle = pJS.particles.shape.stroke.color;
          pJS.canvas.ctx.lineWidth = pJS.particles.shape.stroke.width;
          pJS.canvas.ctx.stroke();
        }
        
        pJS.canvas.ctx.fill();
        
      };
    
    
      pJS.fn.particlesCreate = function(){
        for(var i = 0; i < pJS.particles.number.value; i++) {
          pJS.particles.array.push(new pJS.fn.particle(pJS.particles.color, pJS.particles.opacity.value));
        }
      };
    
      pJS.fn.particlesUpdate = function(){
    
        for(var i = 0; i < pJS.particles.array.length; i++){
    
          /* the particle */
          var p = pJS.particles.array[i];
    
          // var d = ( dx = pJS.interactivity.mouse.click_pos_x - p.x ) * dx + ( dy = pJS.interactivity.mouse.click_pos_y - p.y ) * dy;
          // var f = -BANG_SIZE / d;
          // if ( d < BANG_SIZE ) {
          //     var t = Math.atan2( dy, dx );
          //     p.vx = f * Math.cos(t);
          //     p.vy = f * Math.sin(t);
          // }
    
          /* move the particle */
          if(pJS.particles.move.enable){
            var ms = pJS.particles.move.speed/2;
            p.x += p.vx * ms;
            p.y += p.vy * ms;
          }
    
          /* change opacity status */
          if(pJS.particles.opacity.anim.enable) {
            if(p.opacity_status == true) {
              if(p.opacity >= pJS.particles.opacity.value) p.opacity_status = false;
              p.opacity += p.vo;
            }else {
              if(p.opacity <= pJS.particles.opacity.anim.opacity_min) p.opacity_status = true;
              p.opacity -= p.vo;
            }
            if(p.opacity < 0) p.opacity = 0;
          }
    
          /* change size */
          if(pJS.particles.size.anim.enable){
            if(p.size_status == true){
              if(p.radius >= pJS.particles.size.value) p.size_status = false;
              p.radius += p.vs;
            }else{
              if(p.radius <= pJS.particles.size.anim.size_min) p.size_status = true;
              p.radius -= p.vs;
            }
            if(p.radius < 0) p.radius = 0;
          }
    
          /* change particle position if it is out of canvas */
          if(pJS.particles.move.out_mode == 'bounce'){
            var new_pos = {
              x_left: p.radius,
              x_right:  pJS.canvas.w,
              y_top: p.radius,
              y_bottom: pJS.canvas.h
            }
          }else{
            var new_pos = {
              x_left: -p.radius,
              x_right: pJS.canvas.w + p.radius,
              y_top: -p.radius,
              y_bottom: pJS.canvas.h + p.radius
            }
          }
    
          if(p.x - p.radius > pJS.canvas.w){
            p.x = new_pos.x_left;
            p.y = Math.random() * pJS.canvas.h;
          }
          else if(p.x + p.radius < 0){
            p.x = new_pos.x_right;
            p.y = Math.random() * pJS.canvas.h;
          }
          if(p.y - p.radius > pJS.canvas.h){
            p.y = new_pos.y_top;
            p.x = Math.random() * pJS.canvas.w;
          }
          else if(p.y + p.radius < 0){
            p.y = new_pos.y_bottom;
            p.x = Math.random() * pJS.canvas.w;
          }
    
          /* out of canvas modes */
          switch(pJS.particles.move.out_mode){
            case 'bounce':
              if (p.x + p.radius > pJS.canvas.w) p.vx = -p.vx;
              else if (p.x - p.radius < 0) p.vx = -p.vx;
              if (p.y + p.radius > pJS.canvas.h) p.vy = -p.vy;
              else if (p.y - p.radius < 0) p.vy = -p.vy;
            break;
          }
    
          /* events */
          if(isInArray('grab', pJS.interactivity.events.onhover.mode)){
            pJS.fn.modes.grabParticle(p);
          }
    
          if(isInArray('bubble', pJS.interactivity.events.onhover.mode) || isInArray('bubble', pJS.interactivity.events.onclick.mode)){
            pJS.fn.modes.bubbleParticle(p);
          }
    
          if(isInArray('repulse', pJS.interactivity.events.onhover.mode) || isInArray('repulse', pJS.interactivity.events.onclick.mode)){
            pJS.fn.modes.repulseParticle(p);
          }
    
          /* interaction auto between particles */
          if(pJS.particles.line_linked.enable || pJS.particles.move.attract.enable){
            for(var j = i + 1; j < pJS.particles.array.length; j++){
              var p2 = pJS.particles.array[j];
    
              /* link particles */
              if(pJS.particles.line_linked.enable){
                pJS.fn.interact.linkParticles(p,p2);
              }
    
              /* attract particles */
              if(pJS.particles.move.attract.enable){
                pJS.fn.interact.attractParticles(p,p2);
              }
    
              /* bounce particles */
              if(pJS.particles.move.bounce){
                pJS.fn.interact.bounceParticles(p,p2);
              }
    
            }
          }
    
    
        }
    
      };
    
      pJS.fn.particlesDraw = function(){
    
        /* clear canvas */
        pJS.canvas.ctx.clearRect(0, 0, pJS.canvas.w, pJS.canvas.h);
    
        /* update each particles param */
        pJS.fn.particlesUpdate();
    
        /* draw each particle */
        for(var i = 0; i < pJS.particles.array.length; i++){
          var p = pJS.particles.array[i];
          p.draw();
        }
    
      };
    
      pJS.fn.particlesEmpty = function(){
        pJS.particles.array = [];
      };
    
      pJS.fn.particlesRefresh = function(){
    
        /* init all */
        cancelRequestAnimFrame(pJS.fn.checkAnimFrame);
        cancelRequestAnimFrame(pJS.fn.drawAnimFrame);
        pJS.tmp.source_svg = undefined;
        pJS.tmp.img_obj = undefined;
        pJS.tmp.count_svg = 0;
        pJS.fn.particlesEmpty();
        pJS.fn.canvasClear();
        
        /* restart */
        pJS.fn.vendors.start();
    
      };
    
    
      /* ---------- pJS functions - particles interaction ------------ */
    
      pJS.fn.interact.linkParticles = function(p1, p2){
    
        var dx = p1.x - p2.x,
            dy = p1.y - p2.y,
            dist = Math.sqrt(dx*dx + dy*dy);
    
        /* draw a line between p1 and p2 if the distance between them is under the config distance */
        if(dist <= pJS.particles.line_linked.distance){
    
          var opacity_line = pJS.particles.line_linked.opacity - (dist / (1/pJS.particles.line_linked.opacity)) / pJS.particles.line_linked.distance;
    
          if(opacity_line > 0){        
            
            /* style */
            var color_line = pJS.particles.line_linked.color_rgb_line;
            pJS.canvas.ctx.strokeStyle = 'rgba('+color_line.r+','+color_line.g+','+color_line.b+','+opacity_line+')';
            pJS.canvas.ctx.lineWidth = pJS.particles.line_linked.width;
            //pJS.canvas.ctx.lineCap = 'round'; /* performance issue */
            
            /* path */
            pJS.canvas.ctx.beginPath();
            pJS.canvas.ctx.moveTo(p1.x, p1.y);
            pJS.canvas.ctx.lineTo(p2.x, p2.y);
            pJS.canvas.ctx.stroke();
            pJS.canvas.ctx.closePath();
    
          }
    
        }
    
      };
    
    
      pJS.fn.interact.attractParticles  = function(p1, p2){
    
        /* condensed particles */
        var dx = p1.x - p2.x,
            dy = p1.y - p2.y,
            dist = Math.sqrt(dx*dx + dy*dy);
    
        if(dist <= pJS.particles.line_linked.distance){
    
          var ax = dx/(pJS.particles.move.attract.rotateX*1000),
              ay = dy/(pJS.particles.move.attract.rotateY*1000);
    
          p1.vx -= ax;
          p1.vy -= ay;
    
          p2.vx += ax;
          p2.vy += ay;
    
        }
        
    
      }
    
    
      pJS.fn.interact.bounceParticles = function(p1, p2){
    
        var dx = p1.x - p2.x,
            dy = p1.y - p2.y,
            dist = Math.sqrt(dx*dx + dy*dy),
            dist_p = p1.radius+p2.radius;
    
        if(dist <= dist_p){
          p1.vx = -p1.vx;
          p1.vy = -p1.vy;
    
          p2.vx = -p2.vx;
          p2.vy = -p2.vy;
        }
    
      }
    
    
      /* ---------- pJS functions - modes events ------------ */
    
      pJS.fn.modes.pushParticles = function(nb, pos){
    
        pJS.tmp.pushing = true;
    
        for(var i = 0; i < nb; i++){
          pJS.particles.array.push(
            new pJS.fn.particle(
              pJS.particles.color,
              pJS.particles.opacity.value,
              {
                'x': pos ? pos.pos_x : Math.random() * pJS.canvas.w,
                'y': pos ? pos.pos_y : Math.random() * pJS.canvas.h
              }
            )
          )
          if(i == nb-1){
            if(!pJS.particles.move.enable){
              pJS.fn.particlesDraw();
            }
            pJS.tmp.pushing = false;
          }
        }
    
      };
    
    
      pJS.fn.modes.removeParticles = function(nb){
    
        pJS.particles.array.splice(0, nb);
        if(!pJS.particles.move.enable){
          pJS.fn.particlesDraw();
        }
    
      };
    
    
      pJS.fn.modes.bubbleParticle = function(p){
    
        /* on hover event */
        if(pJS.interactivity.events.onhover.enable && isInArray('bubble', pJS.interactivity.events.onhover.mode)){
    
          var dx_mouse = p.x - pJS.interactivity.mouse.pos_x,
              dy_mouse = p.y - pJS.interactivity.mouse.pos_y,
              dist_mouse = Math.sqrt(dx_mouse*dx_mouse + dy_mouse*dy_mouse),
              ratio = 1 - dist_mouse / pJS.interactivity.modes.bubble.distance;
    
          function init(){
            p.opacity_bubble = p.opacity;
            p.radius_bubble = p.radius;
          }
    
          /* mousemove - check ratio */
          if(dist_mouse <= pJS.interactivity.modes.bubble.distance){
    
            if(ratio >= 0 && pJS.interactivity.status == 'mousemove'){
              
              /* size */
              if(pJS.interactivity.modes.bubble.size != pJS.particles.size.value){
    
                if(pJS.interactivity.modes.bubble.size > pJS.particles.size.value){
                  var size = p.radius + (pJS.interactivity.modes.bubble.size*ratio);
                  if(size >= 0){
                    p.radius_bubble = size;
                  }
                }else{
                  var dif = p.radius - pJS.interactivity.modes.bubble.size,
                      size = p.radius - (dif*ratio);
                  if(size > 0){
                    p.radius_bubble = size;
                  }else{
                    p.radius_bubble = 0;
                  }
                }
    
              }
    
              /* opacity */
              if(pJS.interactivity.modes.bubble.opacity != pJS.particles.opacity.value){
    
                if(pJS.interactivity.modes.bubble.opacity > pJS.particles.opacity.value){
                  var opacity = pJS.interactivity.modes.bubble.opacity*ratio;
                  if(opacity > p.opacity && opacity <= pJS.interactivity.modes.bubble.opacity){
                    p.opacity_bubble = opacity;
                  }
                }else{
                  var opacity = p.opacity - (pJS.particles.opacity.value-pJS.interactivity.modes.bubble.opacity)*ratio;
                  if(opacity < p.opacity && opacity >= pJS.interactivity.modes.bubble.opacity){
                    p.opacity_bubble = opacity;
                  }
                }
    
              }
    
            }
    
          }else{
            init();
          }
    
    
          /* mouseleave */
          if(pJS.interactivity.status == 'mouseleave'){
            init();
          }
        
        }
    
        /* on click event */
        else if(pJS.interactivity.events.onclick.enable && isInArray('bubble', pJS.interactivity.events.onclick.mode)){
    
    
          if(pJS.tmp.bubble_clicking){
            var dx_mouse = p.x - pJS.interactivity.mouse.click_pos_x,
                dy_mouse = p.y - pJS.interactivity.mouse.click_pos_y,
                dist_mouse = Math.sqrt(dx_mouse*dx_mouse + dy_mouse*dy_mouse),
                time_spent = (new Date().getTime() - pJS.interactivity.mouse.click_time)/1000;
    
            if(time_spent > pJS.interactivity.modes.bubble.duration){
              pJS.tmp.bubble_duration_end = true;
            }
    
            if(time_spent > pJS.interactivity.modes.bubble.duration*2){
              pJS.tmp.bubble_clicking = false;
              pJS.tmp.bubble_duration_end = false;
            }
          }
    
    
          function process(bubble_param, particles_param, p_obj_bubble, p_obj, id){
    
            if(bubble_param != particles_param){
    
              if(!pJS.tmp.bubble_duration_end){
                if(dist_mouse <= pJS.interactivity.modes.bubble.distance){
                  if(p_obj_bubble != undefined) var obj = p_obj_bubble;
                  else var obj = p_obj;
                  if(obj != bubble_param){
                    var value = p_obj - (time_spent * (p_obj - bubble_param) / pJS.interactivity.modes.bubble.duration);
                    if(id == 'size') p.radius_bubble = value;
                    if(id == 'opacity') p.opacity_bubble = value;
                  }
                }else{
                  if(id == 'size') p.radius_bubble = undefined;
                  if(id == 'opacity') p.opacity_bubble = undefined;
                }
              }else{
                if(p_obj_bubble != undefined){
                  var value_tmp = p_obj - (time_spent * (p_obj - bubble_param) / pJS.interactivity.modes.bubble.duration),
                      dif = bubble_param - value_tmp;
                      value = bubble_param + dif;
                  if(id == 'size') p.radius_bubble = value;
                  if(id == 'opacity') p.opacity_bubble = value;
                }
              }
    
            }
    
          }
    
          if(pJS.tmp.bubble_clicking){
            /* size */
            process(pJS.interactivity.modes.bubble.size, pJS.particles.size.value, p.radius_bubble, p.radius, 'size');
            /* opacity */
            process(pJS.interactivity.modes.bubble.opacity, pJS.particles.opacity.value, p.opacity_bubble, p.opacity, 'opacity');
          }
    
        }
    
      };
    
    
      pJS.fn.modes.repulseParticle = function(p){
    
        if(pJS.interactivity.events.onhover.enable && isInArray('repulse', pJS.interactivity.events.onhover.mode) && pJS.interactivity.status == 'mousemove') {
    
          var dx_mouse = p.x - pJS.interactivity.mouse.pos_x,
              dy_mouse = p.y - pJS.interactivity.mouse.pos_y,
              dist_mouse = Math.sqrt(dx_mouse*dx_mouse + dy_mouse*dy_mouse);
    
          var normVec = {x: dx_mouse/dist_mouse, y: dy_mouse/dist_mouse},
              repulseRadius = pJS.interactivity.modes.repulse.distance,
              velocity = 100,
              repulseFactor = clamp((1/repulseRadius)*(-1*Math.pow(dist_mouse/repulseRadius,2)+1)*repulseRadius*velocity, 0, 50);
          
          var pos = {
            x: p.x + normVec.x * repulseFactor,
            y: p.y + normVec.y * repulseFactor
          }
    
          if(pJS.particles.move.out_mode == 'bounce'){
            if(pos.x - p.radius > 0 && pos.x + p.radius < pJS.canvas.w) p.x = pos.x;
            if(pos.y - p.radius > 0 && pos.y + p.radius < pJS.canvas.h) p.y = pos.y;
          }else{
            p.x = pos.x;
            p.y = pos.y;
          }
        
        }
    
    
        else if(pJS.interactivity.events.onclick.enable && isInArray('repulse', pJS.interactivity.events.onclick.mode)) {
    
          if(!pJS.tmp.repulse_finish){
            pJS.tmp.repulse_count++;
            if(pJS.tmp.repulse_count == pJS.particles.array.length){
              pJS.tmp.repulse_finish = true;
            }
          }
    
          if(pJS.tmp.repulse_clicking){
    
            var repulseRadius = Math.pow(pJS.interactivity.modes.repulse.distance/6, 3);
    
            var dx = pJS.interactivity.mouse.click_pos_x - p.x,
                dy = pJS.interactivity.mouse.click_pos_y - p.y,
                d = dx*dx + dy*dy;
    
            var force = -repulseRadius / d * 1;
    
            function process(){
    
              var f = Math.atan2(dy,dx);
              p.vx = force * Math.cos(f);
              p.vy = force * Math.sin(f);
    
              if(pJS.particles.move.out_mode == 'bounce'){
                var pos = {
                  x: p.x + p.vx,
                  y: p.y + p.vy
                }
                if (pos.x + p.radius > pJS.canvas.w) p.vx = -p.vx;
                else if (pos.x - p.radius < 0) p.vx = -p.vx;
                if (pos.y + p.radius > pJS.canvas.h) p.vy = -p.vy;
                else if (pos.y - p.radius < 0) p.vy = -p.vy;
              }
    
            }
    
            // default
            if(d <= repulseRadius){
              process();
            }
    
            // bang - slow motion mode
            // if(!pJS.tmp.repulse_finish){
            //   if(d <= repulseRadius){
            //     process();
            //   }
            // }else{
            //   process();
            // }
            
    
          }else{
    
            if(pJS.tmp.repulse_clicking == false){
    
              p.vx = p.vx_i;
              p.vy = p.vy_i;
            
            }
    
          }
    
        }
    
      }
    
    
      pJS.fn.modes.grabParticle = function(p){
    
        if(pJS.interactivity.events.onhover.enable && pJS.interactivity.status == 'mousemove'){
    
          var dx_mouse = p.x - pJS.interactivity.mouse.pos_x,
              dy_mouse = p.y - pJS.interactivity.mouse.pos_y,
              dist_mouse = Math.sqrt(dx_mouse*dx_mouse + dy_mouse*dy_mouse);
    
          /* draw a line between the cursor and the particle if the distance between them is under the config distance */
          if(dist_mouse <= pJS.interactivity.modes.grab.distance){
    
            var opacity_line = pJS.interactivity.modes.grab.line_linked.opacity - (dist_mouse / (1/pJS.interactivity.modes.grab.line_linked.opacity)) / pJS.interactivity.modes.grab.distance;
    
            if(opacity_line > 0){
    
              /* style */
              var color_line = pJS.particles.line_linked.color_rgb_line;
              pJS.canvas.ctx.strokeStyle = 'rgba('+color_line.r+','+color_line.g+','+color_line.b+','+opacity_line+')';
              pJS.canvas.ctx.lineWidth = pJS.particles.line_linked.width;
              //pJS.canvas.ctx.lineCap = 'round'; /* performance issue */
              
              /* path */
              pJS.canvas.ctx.beginPath();
              pJS.canvas.ctx.moveTo(p.x, p.y);
              pJS.canvas.ctx.lineTo(pJS.interactivity.mouse.pos_x, pJS.interactivity.mouse.pos_y);
              pJS.canvas.ctx.stroke();
              pJS.canvas.ctx.closePath();
    
            }
    
          }
    
        }
    
      };
    
    
    
      /* ---------- pJS functions - vendors ------------ */
    
      pJS.fn.vendors.eventsListeners = function(){
    
        /* events target element */
        if(pJS.interactivity.detect_on == 'window'){
          pJS.interactivity.el = window;
        }else{
          pJS.interactivity.el = pJS.canvas.el;
        }
    
    
        /* detect mouse pos - on hover / click event */
        if(pJS.interactivity.events.onhover.enable || pJS.interactivity.events.onclick.enable){
    
          /* el on mousemove */
          pJS.interactivity.el.addEventListener('mousemove', function(e){
    
            if(pJS.interactivity.el == window){
              var pos_x = e.clientX,
                  pos_y = e.clientY;
            }
            else{
              var pos_x = e.offsetX || e.clientX,
                  pos_y = e.offsetY || e.clientY;
            }
    
            pJS.interactivity.mouse.pos_x = pos_x;
            pJS.interactivity.mouse.pos_y = pos_y;
    
            if(pJS.tmp.retina){
              pJS.interactivity.mouse.pos_x *= pJS.canvas.pxratio;
              pJS.interactivity.mouse.pos_y *= pJS.canvas.pxratio;
            }
    
            pJS.interactivity.status = 'mousemove';
    
          });
    
          /* el on onmouseleave */
          pJS.interactivity.el.addEventListener('mouseleave', function(e){
    
            pJS.interactivity.mouse.pos_x = null;
            pJS.interactivity.mouse.pos_y = null;
            pJS.interactivity.status = 'mouseleave';
    
          });
    
        }
    
        /* on click event */
        if(pJS.interactivity.events.onclick.enable){
    
          pJS.interactivity.el.addEventListener('click', function(){
    
            pJS.interactivity.mouse.click_pos_x = pJS.interactivity.mouse.pos_x;
            pJS.interactivity.mouse.click_pos_y = pJS.interactivity.mouse.pos_y;
            pJS.interactivity.mouse.click_time = new Date().getTime();
    
            if(pJS.interactivity.events.onclick.enable){
    
              switch(pJS.interactivity.events.onclick.mode){
    
                case 'push':
                  if(pJS.particles.move.enable){
                    pJS.fn.modes.pushParticles(pJS.interactivity.modes.push.particles_nb, pJS.interactivity.mouse);
                  }else{
                    if(pJS.interactivity.modes.push.particles_nb == 1){
                      pJS.fn.modes.pushParticles(pJS.interactivity.modes.push.particles_nb, pJS.interactivity.mouse);
                    }
                    else if(pJS.interactivity.modes.push.particles_nb > 1){
                      pJS.fn.modes.pushParticles(pJS.interactivity.modes.push.particles_nb);
                    }
                  }
                break;
    
                case 'remove':
                  pJS.fn.modes.removeParticles(pJS.interactivity.modes.remove.particles_nb);
                break;
    
                case 'bubble':
                  pJS.tmp.bubble_clicking = true;
                break;
    
                case 'repulse':
                  pJS.tmp.repulse_clicking = true;
                  pJS.tmp.repulse_count = 0;
                  pJS.tmp.repulse_finish = false;
                  setTimeout(function(){
                    pJS.tmp.repulse_clicking = false;
                  }, pJS.interactivity.modes.repulse.duration*1000)
                break;
    
              }
    
            }
    
          });
            
        }
    
    
      };
    
      pJS.fn.vendors.densityAutoParticles = function(){
    
        if(pJS.particles.number.density.enable){
    
          /* calc area */
          var area = pJS.canvas.el.width * pJS.canvas.el.height / 1000;
          if(pJS.tmp.retina){
            area = area/(pJS.canvas.pxratio*2);
          }
    
          /* calc number of particles based on density area */
          var nb_particles = area * pJS.particles.number.value / pJS.particles.number.density.value_area;
    
          /* add or remove X particles */
          var missing_particles = pJS.particles.array.length - nb_particles;
          if(missing_particles < 0) pJS.fn.modes.pushParticles(Math.abs(missing_particles));
          else pJS.fn.modes.removeParticles(missing_particles);
    
        }
    
      };
    
    
      pJS.fn.vendors.checkOverlap = function(p1, position){
        for(var i = 0; i < pJS.particles.array.length; i++){
          var p2 = pJS.particles.array[i];
    
          var dx = p1.x - p2.x,
              dy = p1.y - p2.y,
              dist = Math.sqrt(dx*dx + dy*dy);
    
          if(dist <= p1.radius + p2.radius){
            p1.x = position ? position.x : Math.random() * pJS.canvas.w;
            p1.y = position ? position.y : Math.random() * pJS.canvas.h;
            pJS.fn.vendors.checkOverlap(p1);
          }
        }
      };
    
    
      pJS.fn.vendors.createSvgImg = function(p){
    
        /* set color to svg element */
        var svgXml = pJS.tmp.source_svg,
            rgbHex = /#([0-9A-F]{3,6})/gi,
            coloredSvgXml = svgXml.replace(rgbHex, function (m, r, g, b) {
              if(p.color.rgb){
                var color_value = 'rgba('+p.color.rgb.r+','+p.color.rgb.g+','+p.color.rgb.b+','+p.opacity+')';
              }else{
                var color_value = 'hsla('+p.color.hsl.h+','+p.color.hsl.s+'%,'+p.color.hsl.l+'%,'+p.opacity+')';
              }
              return color_value;
            });
    
        /* prepare to create img with colored svg */
        var svg = new Blob([coloredSvgXml], {type: 'image/svg+xml;charset=utf-8'}),
            DOMURL = window.URL || window.webkitURL || window,
            url = DOMURL.createObjectURL(svg);
    
        /* create particle img obj */
        var img = new Image();
        img.addEventListener('load', function(){
          p.img.obj = img;
          p.img.loaded = true;
          DOMURL.revokeObjectURL(url);
          pJS.tmp.count_svg++;
        });
        img.src = url;
    
      };
    
    
      pJS.fn.vendors.destroypJS = function(){
        cancelAnimationFrame(pJS.fn.drawAnimFrame);
        canvas_el.remove();
        pJSDom = null;
      };
    
    
      pJS.fn.vendors.drawShape = function(c, startX, startY, sideLength, sideCountNumerator, sideCountDenominator){
    
        // By Programming Thomas - https://programmingthomas.wordpress.com/2013/04/03/n-sided-shapes/
        var sideCount = sideCountNumerator * sideCountDenominator;
        var decimalSides = sideCountNumerator / sideCountDenominator;
        var interiorAngleDegrees = (180 * (decimalSides - 2)) / decimalSides;
        var interiorAngle = Math.PI - Math.PI * interiorAngleDegrees / 180; // convert to radians
        c.save();
        c.beginPath();
        c.translate(startX, startY);
        c.moveTo(0,0);
        for (var i = 0; i < sideCount; i++) {
          c.lineTo(sideLength,0);
          c.translate(sideLength,0);
          c.rotate(interiorAngle);
        }
        //c.stroke();
        c.fill();
        c.restore();
    
      };
    
      pJS.fn.vendors.exportImg = function(){
        window.open(pJS.canvas.el.toDataURL('image/png'), '_blank');
      };
    
    
      pJS.fn.vendors.loadImg = function(type){
    
        pJS.tmp.img_error = undefined;
    
        if(pJS.particles.shape.image.src != ''){
    
          if(type == 'svg'){
    
            var xhr = new XMLHttpRequest();
            xhr.open('GET', pJS.particles.shape.image.src);
            xhr.onreadystatechange = function (data) {
              if(xhr.readyState == 4){
                if(xhr.status == 200){
                  pJS.tmp.source_svg = data.currentTarget.response;
                  pJS.fn.vendors.checkBeforeDraw();
                }else{
                  console.log('Error pJS - Image not found');
                  pJS.tmp.img_error = true;
                }
              }
            }
            xhr.send();
    
          }else{
    
            var img = new Image();
            img.addEventListener('load', function(){
              pJS.tmp.img_obj = img;
              pJS.fn.vendors.checkBeforeDraw();
            });
            img.src = pJS.particles.shape.image.src;
    
          }
    
        }else{
          console.log('Error pJS - No image.src');
          pJS.tmp.img_error = true;
        }
    
      };
    
    
      pJS.fn.vendors.draw = function(){
    
        if(pJS.particles.shape.type == 'image'){
    
          if(pJS.tmp.img_type == 'svg'){
    
            if(pJS.tmp.count_svg >= pJS.particles.number.value){
              pJS.fn.particlesDraw();
              if(!pJS.particles.move.enable) cancelRequestAnimFrame(pJS.fn.drawAnimFrame);
              else pJS.fn.drawAnimFrame = requestAnimFrame(pJS.fn.vendors.draw);
            }else{
              //console.log('still loading...');
              if(!pJS.tmp.img_error) pJS.fn.drawAnimFrame = requestAnimFrame(pJS.fn.vendors.draw);
            }
    
          }else{
    
            if(pJS.tmp.img_obj != undefined){
              pJS.fn.particlesDraw();
              if(!pJS.particles.move.enable) cancelRequestAnimFrame(pJS.fn.drawAnimFrame);
              else pJS.fn.drawAnimFrame = requestAnimFrame(pJS.fn.vendors.draw);
            }else{
              if(!pJS.tmp.img_error) pJS.fn.drawAnimFrame = requestAnimFrame(pJS.fn.vendors.draw);
            }
    
          }
    
        }else{
          pJS.fn.particlesDraw();
          if(!pJS.particles.move.enable) cancelRequestAnimFrame(pJS.fn.drawAnimFrame);
          else pJS.fn.drawAnimFrame = requestAnimFrame(pJS.fn.vendors.draw);
        }
    
      };
    
    
      pJS.fn.vendors.checkBeforeDraw = function(){
    
        // if shape is image
        if(pJS.particles.shape.type == 'image'){
    
          if(pJS.tmp.img_type == 'svg' && pJS.tmp.source_svg == undefined){
            pJS.tmp.checkAnimFrame = requestAnimFrame(check);
          }else{
            //console.log('images loaded! cancel check');
            cancelRequestAnimFrame(pJS.tmp.checkAnimFrame);
            if(!pJS.tmp.img_error){
              pJS.fn.vendors.init();
              pJS.fn.vendors.draw();
            }
            
          }
    
        }else{
          pJS.fn.vendors.init();
          pJS.fn.vendors.draw();
        }
    
      };
    
    
      pJS.fn.vendors.init = function(){
    
        /* init canvas + particles */
        pJS.fn.retinaInit();
        pJS.fn.canvasInit();
        pJS.fn.canvasSize();
        pJS.fn.canvasPaint();
        pJS.fn.particlesCreate();
        pJS.fn.vendors.densityAutoParticles();
    
        /* particles.line_linked - convert hex colors to rgb */
        pJS.particles.line_linked.color_rgb_line = hexToRgb(pJS.particles.line_linked.color);
    
      };
    
    
      pJS.fn.vendors.start = function(){
    
        if(isInArray('image', pJS.particles.shape.type)){
          pJS.tmp.img_type = pJS.particles.shape.image.src.substr(pJS.particles.shape.image.src.length - 3);
          pJS.fn.vendors.loadImg(pJS.tmp.img_type);
        }else{
          pJS.fn.vendors.checkBeforeDraw();
        }
    
      };
    
    
    
    
      /* ---------- pJS - start ------------ */
    
    
      pJS.fn.vendors.eventsListeners();
    
      pJS.fn.vendors.start();
      
    
    
  };

  /* ---------- global functions - vendors ------------ */

  Object.deepExtend = function(destination, source) {
    for (var property in source) {
      if (source[property] && source[property].constructor &&
        source[property].constructor === Object) {
        destination[property] = destination[property] || {};
        arguments.callee(destination[property], source[property]);
      } else {
        destination[property] = source[property];
      }
    }
    return destination;
  };

  window.requestAnimFrame = (function(){
    return  window.requestAnimationFrame ||
      window.webkitRequestAnimationFrame ||
      window.mozRequestAnimationFrame    ||
      window.oRequestAnimationFrame      ||
      window.msRequestAnimationFrame     ||
      function(callback){
        window.setTimeout(callback, 1000 / 60);
      };
  })();

  window.cancelRequestAnimFrame = ( function() {
    return window.cancelAnimationFrame         ||
      window.webkitCancelRequestAnimationFrame ||
      window.mozCancelRequestAnimationFrame    ||
      window.oCancelRequestAnimationFrame      ||
      window.msCancelRequestAnimationFrame     ||
      clearTimeout
  })();

  function hexToRgb(hex){
    // By Tim Down - http://stackoverflow.com/a/5624139/3493650
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function(m, r, g, b) {
        return r + r + g + g + b + b;
    });
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
  };

  function clamp(number, min, max) {
    return Math.min(Math.max(number, min), max);
  };

  function isInArray(value, array) {
    return array.indexOf(value) > -1;
  };

  /* ---------- particles.js functions - start ------------ */

  window.pJSDom = [];

  window.particlesJS = function(tag_id, params){

    //console.log(params);

    /* no string id? so it's object params, and set the id with default id */
    if(typeof(tag_id) != 'string'){
      params = tag_id;
      tag_id = 'particles-js';
    }

    /* no id? set the id to default id */
    if(!tag_id){
      tag_id = 'particles-js';
    }

    /* pJS elements */
    var pJS_tag = document.getElementById(tag_id),
        pJS_canvas_class = 'particles-js-canvas-el',
        exist_canvas = pJS_tag.getElementsByClassName(pJS_canvas_class);

    /* remove canvas if exists into the pJS target tag */
    if(exist_canvas.length){
      while(exist_canvas.length > 0){
        pJS_tag.removeChild(exist_canvas[0]);
      }
    }

    /* create canvas element */
    var canvas_el = document.createElement('canvas');
    canvas_el.className = pJS_canvas_class;

    /* set size canvas */
    canvas_el.style.width = "100%";
    canvas_el.style.height = "100%";

    /* append canvas */
    var canvas = document.getElementById(tag_id).appendChild(canvas_el);

    /* launch particle.js */
    if(canvas != null){
      pJSDom.push(new pJS(tag_id, params));
    }

  };

  window.particlesJS.load = function(tag_id, path_config_json, callback){

    /* load json config */
    var xhr = new XMLHttpRequest();
    xhr.open('GET', path_config_json);
    xhr.onreadystatechange = function (data) {
      if(xhr.readyState == 4){
        if(xhr.status == 200){
          var params = JSON.parse(data.currentTarget.response);
          window.particlesJS(tag_id, params);
          if(callback) callback();
        }else{
          console.log('Error pJS - XMLHttpRequest status: '+xhr.status);
          console.log('Error pJS - File config not found');
        }
      }
    };
    xhr.send();

  };
    
  particlesJS('swarm',
    
  {
    "particles": {
      "number": {
        "value": 164,
        "density": {
          "enable": true,
          "value_area": 800
        }
      },
      "color": {
        "value": "#222222"
      },
      "shape": {
        "type": "triangle",
        "stroke": {
          "width": 0,
          "color": "#000000"
        },
        "polygon": {
          "nb_sides": 3
        },
        "image": {
          "src": "img/github.svg",
          "width": 100,
          "height": 100
        }
      },
      "opacity": {
        "value": 0.6974842464765024,
        "random": false,
        "anim": {
          "enable": false,
          "speed": 0.5684540486109415,
          "opacity_min": 0.09744926547616141,
          "sync": true
        }
      },
      "size": {
        "value": 3,
        "random": true,
        "anim": {
          "enable": false,
          "speed": 40,
          "size_min": 0.1,
          "sync": false
        }
      },
      "line_linked": {
        "enable": true,
        "distance": 150,
        "color": "#222222",
        "opacity": 0.4,
        "width": 1
      },
      "move": {
        "enable": true,
        "speed": 6,
        "direction": "none",
        "random": false,
        "straight": false,
        "out_mode": "out",
        "bounce": false,
        "attract": {
          "enable": false,
          "rotateX": 600,
          "rotateY": 1200
        }
      }
    },
    "interactivity": {
      "detect_on": "canvas",
      "events": {
        "onhover": {
          "enable": true,
          "mode": "bubble"
        },
        "onclick": {
          "enable": true,
          "mode": "push"
        },
        "resize": true
      },
      "modes": {
        "grab": {
          "distance": 182.71737276780266,
          "line_linked": {
            "opacity": 1
          }
        },
        "bubble": {
          "distance": 170.53621458328246,
          "size": 24.362316369040354,
          "duration": 2,
          "opacity": 0.7958356680553182,
          "speed": 3
        },
        "repulse": {
          "distance": 56.84540486109416,
          "duration": 0.4
        },
        "push": {
          "particles_nb": 4
        },
        "remove": {
          "particles_nb": 2
        }
      }
    },
    "retina_detect": false
  }

  );

}