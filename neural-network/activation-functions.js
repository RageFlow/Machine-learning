import { Network } from "./neural-network";

class ActivationFunction{
    
    static heaviside(x){
        return x < 0 ? 0 : 1;
    }

    static identity(x){
        return x;
    }

    // Non linear ******************************************************

    static sigmoid(x){
        return 1 / (1 + Math.exp(-x));
    }
    
    static sigmoidLike(x){
        return 0.5 + 0.5 * x / (1 + Math.abs(x));
    }

    static sigmoidDerivative(x){
        return x * (1 - x);
    }

    static sigmoidLike2(x, params = {}){
        let n = params.n;
        return 0.5 + 0.5 * x / (n + Math.abs(x));
    }
    
    static sigmoidLike2Derivative(x, params = {}){
        let n = params.n;
        return n / Math.pow(n + Math.abs(x), 2);
    }

    // Tangent

    static tanh(x){
        return Math.tanh(x);
    }

    static tanhDerivative(x){
        let y = Math.tanh(x)
        return 1 - y * y;
    }

    static tanhLike(x){
        return x / (1 + Math.abs(x))
    }
    
    static tanhLikeDerivative(x){
        return 1 / Math.pow(1 + Math.abs(x), 2);
    }
    
    static tanhLik2(x, params = {}){
        let n = params.n;
        return x / (n + Math.abs(x));
    }
    
    static tanhLik2Derivative(x, n = 1.0){
        return n / Math.pow(n + Math.abs(x), 2);
    }

    // Rational Tanh

    static rationalTanh(x, m = 2.7, n = 7.5){
        if (x < - 3) return  - 1;
        if (x > 3) return 1;
        return x * (m * n + x * x) / (m * n + n * x);
    }

    // Relu
    
    static relu(x){
        return Math.max(0, x);
    }

    static paramRelu(x, a = 0.01){
        return Math.max(a * x, x);
    }
    
    // Nice to haves

    static sin(x){
        return Math.sin(x);
    }
    static cos(x){
        return Math.cos(x);
    }
    static tan(x){
        return Math.tan(x);
    }

    static sinMoid(x, a = 2, b = 0.5){
        return 0.5 + 0.5 + this.sin(Math.Pi * (a * x + b));
    }
}

export { ActivationFunction };

