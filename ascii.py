import random

ingredients_count = {
    'coffee': 0,
    'milk' : 10,
    'espresso': 3,
    'kolle mate' : 2,
    'premium cola' : 0
}

max = {
    'coffee': 10,
    'milk' : 10,
    'espresso': 10,
    'kolle mate' : 5,
    'premium cola' : 5
}

ingredients = {
    'kaffee': {'coffee': 2},
    'latte macchiato': {'espresso': 2, 'milk': 4},
    'kolle mate': {'kolle mate': 1},
    'premium cola': {'premium cola': 1}
}

prices = {'kaffee': 0.8,
    'latte macchiato': 1,
    'kolle mate': 1.5,
    'premium cola': 1.5}

customers = []


class Customer:
    def __init__(self, level):
        # TODO Customers should order more/other/...
        self.items = ['kaffee', 'kolle mate']
        self.price = 0
        for item in self.items:
            self.price += prices[item]
        self.happy = False
        print("New Customer!")

    def serve(self, item):
        if item in self.items:
            index = self.items.index(item)
            del self.items[index]
            return 'Customer got: ' + item
        else:
            return "Customer wants " + self.items + ", but you served " + item

    def bill(self, price):
        if self.price == price:
            self.happy = True
            return True
        else:
            print('Wrong price :(')
            return False

    def __str__(self):
        return str(self.items)


def new_customer():
    rand = random.randint(0, 9)
    if rand in range(2):
        customers.append(Customer(1))
        if len(customers) == 1:
            print('Customer wants ', str(customers[0]))


def fill(ingredient):
    ingredients_count[ingredient] = max[ingredient]
    return max[ingredient]


def check_ingredients(item):
    contraints = ingredients[item]
    for key in contraints:
        if ingredients_count[key] < contraints[key]:
            return False, key + ' is missing for ' + item
    return True, ''


def get(item):
    contraints = ingredients[item]
    for ingredient in contraints:
        ingredients_count[ingredient] -= contraints[ingredient]


def serve(item):
    state, msg = check_ingredients(item)
    if state:
        get(item)
        if customers:
            return customers[0].serve(item)
        else:
            return 'You served a ' +item+', but nobody else is here...'
    return msg

