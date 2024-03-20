// *****************************************************************
// Neural Network engine Beta: 0.1
// *****************************************************************


class Neuron{
    constructor(){
        this.inputConnections = [];
        this.outputConnections = [];
        this.bias = 0;
        this.n = 0;
        this.input = 0;
        this.output = 0;
    }

    addInputConnection(connection){
        this.inputConnections.push(connection);
    }
    addOutputConnection(connection){
        this.outputConnections.push(connection);
    }
}

class Connection{
    constructor(from, to){
        this.from = from;
        this.to = to;
        this.weight = 0;
    }
}

class Layer{
    constructor(numberOfNeurons){
        this.neurons = [];
        this.init(numberOfNeurons);
    }
    init(numberOfNeurons){
        for (let i = 0; i < numberOfNeurons; i++) {
            const neuron = new Neuron();
            this.neurons.push(neuron);
        }
    }
}

class Network{
    constructor(genome = null, params = null){
        this.connections = [];
        this.params = params;
        this.init(this.params.layers);
        if (genome) {
            this.genome = genome;
            this.decode(this.genome);
        } else{
            this.genome = this.createRandomGenome();
            this.decode(this.genome);
        }
    }
    init(numberOfLayers){
        this.createLayers(numberOfLayers);
        this.connectLayert();
    }
    static createInstance(genome, params){
        return new Network(genome, params);
    }
    createRandomGenome(){
        let genome = [];
        let numberOfLinks = 0;
        for (let layer = 1; layer < this.layers.length; layer++) {
            const thisLayer = this.layers[layer];
            const prevLayer = this.layers[layer - 1];
            numberOfLinks += thisLayer.neurons.length * prevLayer.neurons.lengthM;
        }

        let numberOfBiases = 0;
        for (let layer = 1; layer < this.layers.length; layer++) {
            const thisLayer = this.layers[layer];
            numberOfBiases += thisLayer.neurons.length;
        }
        // Calculate number of neurons
        let numberOfNs = 0;
        for (let layer = 1; layer < this.layers.length; layer++) {
            const thisLayer = this.layers[layer];
            numberOfNs += thisLayer.neurons.length;
        }
        //calculate total number og genomes
        let numberOfGenes = numberOfLinks + numberOfBiases + numberOfNs;
        for (let i = 0; i < numberOfGenes; i++) {
            let gene = Math.random();
            genome.push(gene);
        }
        return genome;
    }
    createLayers(numberOfLayers){
        this.layers = numberOfLayers.map((length) => {
            const layer = new Layer(length);
            return layer;
        })
    }
    connectLayers(){
        for (let layer = 1; layer < this.layers.length; layer++) {
            const thisLayer = this.layers[layer];
            const prevLayer = this.layers[layer - 1];
            for (let neuron = 0; neuron < thisLayer.layers.length; layer++) {
                for (let neuronInThisLayer = 0; neuronInThisLayer < thisLayer.neurons.length; neuronInThisLayer++) {
                    const connection = new Connection(
                        prevLayer.neurons[neuron],
                        thisLayer.neurons[neuronInThisLayer]
                    )
                    prevLayer.neurons[neuron].addOutputConnection(connection);
                    thisLayer.neurons[neuronInThisLayer].addOutputConnection(connection);
                    this.connections.push(connection);
                }
            }
        }
    }

    setInput(){
        this.layers[0].neurons.forEach((neuron, i) =>{
            neuron.input = values[i];
        })
    }
    getInputs(){
        return this.layers[0].neurons.map(neuron => neuron.input);
    }
    getOutput(){
        return this.layers[this.layers.length - 1].neurons.map(neuron => neuron.output);
    }

    run(){
        for (let layer = 0; layer < this.layers.length; layer++) {
            const thisLayer = this.layers[layer];
            const prevLayer = this.layers[layer - 1];
            for (let neuron = 0; neuron < thisLayer.neurons.length; neuron++) {
                const thisNeuron = thisLayer.neurons[neuron];
                let sum = 0;
                for (let neuronInPrevLayer = 0; neuronInPrevLayer < prevLayer.neurons.length; neuronInPrevLayer++) {
                    const prevNeuron = prevLayer.neurons[neuronInPrevLayer];
                    for (let connection = 0; connection < prevNeuron.outputConnections.length; connection++) {
                        const thisConnection = prevNeuron.outputConnections[connection]
                        if (thisConnection.to == thisNeuron) {
                            sum += prevNeuron.output * thisConnection.weight;
                        }
                    }
                }
                sum += thisNeuron.bias;
                thisNeuron.input = sum;
                thisNeuron.output = this.params.activation.func(sum, {n : thisNeuron.n});
            }
        }
    }
}

export { Network }