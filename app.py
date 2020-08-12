from flask import Flask
from flask import render_template
import ascii


app = Flask(__name__)


@app.route('/')
def hello_world():
    return render_template('main.html')

@app.route('/level/<ingredient>')
def get_fill_level(ingredient):
    items_count = ascii.ingredients_count
    if ingredient in items_count:
        return str(items_count[ingredient])
    else:
        return '0'

@app.route('/level')
def get_all_fill_level():
    return ascii.ingredients_count

@app.route('/refill/<ingredient>')
def refill(ingredient):
    return str(ascii.fill(ingredient))

@app.route('/serve/<beverage>')
def serve(beverage):
    return {'msg': ascii.serve(beverage), 'ingredients': ascii.ingredients_count}

@app.route('/ingredients')
def get_all_ingredients():
    return {'ingredients': list(ascii.ingredients_count.keys())}

@app.route('/items')
def get_all_items():
    return {'items': list(ascii.ingredients.keys())}

if __name__ == '__main__':
    app.run()
