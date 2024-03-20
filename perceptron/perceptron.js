
class Perceptron{
    constructor(n, c){
        // Array of inputs
        this.weights = new Array(n);

        // Start loop with weights
        for (let i = 0; i < this.weights.length; i++) {
            // Random value between -1 and 1
            this.weights[i] = Math.random() * 2 - 1;
        }

        // Learning code
        this.c = c;
    }

    train(inputs, desired){
        // Guess the result
        const guess = this.feedForward(inputs);
        // Comupte for error => change weights
        // Error = desired output - guess output
        const error = desired - guess;
        for (let i = 0; i < this.weights.length; i++) {
            this.weights[1] += this.c * error * inputs[i];
        }
    }

    feedForward(inputs){
        let sum = 0;
        for (let i = 0; i < this.weights.length; i++) {
            sum += inputs[i] * this.weights[i]
        }

        // return the result
        return this.activate(sum);
    }

    activate(sum){
        if (sum > 0) return 1;
        else return -1;
    }

    getWeights(){
        return this.weights;
    }

}