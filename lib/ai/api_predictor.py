#!/usr/bin/env python3
"""
CPU Product Predictor API Wrapper
Returns JSON responses for web API integration
"""

import sys
import json
import argparse
from simple_cpu_predictor import SimpleCPUPredictor

def main():
    parser = argparse.ArgumentParser(description='CPU Product Predictor API')
    parser.add_argument('--query', type=str, help='Product query to search for')
    parser.add_argument('--similar', type=str, help='Find similar products')
    parser.add_argument('--analysis', type=str, help='Get market analysis for product')
    parser.add_argument('--batch', action='store_true', help='Process batch queries from stdin')
    
    args = parser.parse_args()
    
    try:
        # Initialize predictor with correct paths
        import os
        script_dir = os.path.dirname(os.path.abspath(__file__))
        predictor = SimpleCPUPredictor(
            classifier_path=os.path.join(script_dir, "cpu_classifier.pkl"),
            vectorizer_path=os.path.join(script_dir, "cpu_vectorizer.pkl"),
            db_path=os.path.join(script_dir, "..", "..", "cpu_products.db")
        )
        
        if args.query:
            # Single product prediction
            result = predictor.predict_product(args.query)
            print(json.dumps({
                'type': 'prediction',
                'query': args.query,
                'result': result
            }))
            
        elif args.similar:
            # Find similar products
            similar = predictor.find_similar_products(args.similar, top_k=10)
            print(json.dumps({
                'type': 'similar',
                'query': args.similar,
                'results': similar
            }))
            
        elif args.analysis:
            # Market analysis
            analysis = predictor.get_market_analysis(args.analysis)
            print(json.dumps({
                'type': 'analysis',
                'product': args.analysis,
                'analysis': analysis
            }))
            
        elif args.batch:
            # Batch processing from stdin
            queries = []
            for line in sys.stdin:
                query = line.strip()
                if query:
                    result = predictor.predict_product(query)
                    queries.append({
                        'query': query,
                        'result': result
                    })
            
            print(json.dumps({
                'type': 'batch',
                'count': len(queries),
                'results': queries
            }))
            
        else:
            # Default: return available products
            all_products = list(predictor.price_mapping.keys())
            print(json.dumps({
                'type': 'products',
                'count': len(all_products),
                'products': all_products[:50]  # First 50 products
            }))
            
    except Exception as e:
        print(json.dumps({
            'type': 'error',
            'error': str(e)
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()
