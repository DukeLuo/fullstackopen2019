const mongoose = require('mongoose');
const supertest = require('supertest');
const app = require('../app');
const helper = require('./test_helper');
const Phonebook = require('../models/phonebook');
const User = require('../models/user');
const api = supertest(app);

beforeEach(async () => {
    await User.deleteMany({});
    await Promise.all(helper.initialUser.map(u => new User(u).save()));
    await Phonebook.deleteMany({});
    const userId = await helper.validUserId();
    for (let person of helper.initialPhonebook) {
        person.user = userId;
        await new Phonebook(person).save();
    }
});

describe('when there is initially a phonebook', () => {
    test('phonebook are returned as json ', async (done) => {
        const { status, header } = await api.get('/api/persons');

        expect(status).toBe(200);
        expect(header['content-type']).toContain('application/json');
        done();
    });

    test('all persons in the phonebook are returned', async (done) => {
        const { body } = await api.get('/api/persons');

        expect(body.length).toBe(helper.initialPhonebook.length);
        done();
    });

    test('a specific person is within the returned persons', async (done) => {
        const { body } = await api.get('/api/persons');
        const names = body.map(p => p.name);
        const numbers = body.map(p => p.number);
        const usernames = body.map(p => p.user.username);

        expect(names).toContain(helper.initialPhonebook[0].name);
        expect(numbers).toContain(helper.initialPhonebook[0].number);
        expect(usernames).toContain(helper.initialUser[0].username);
        done();
    });

    describe('viewing a specific person', () => {
        test('succeeds with a valid id', async (done) => {
            const phonebookAtStart = await helper.personsInDb();
            const personToView = phonebookAtStart[0];
            await api.get(`/api/persons/${personToView.id}`).expect(200);

            done();
        });

        test('fails with statuscode 400 id is invalid ', async (done) => {
            await api.get(`/api/persons/${helper.invalidId()}`).expect(400);
            done();
        });

        test('fails with statuscode 404 if person does not exist ', async (done) => {
            await api.get(`/api/persons/${await helper.nonExistingId()}`).expect(404);
            done();
        });
    });

    describe('adding a specific person', () => {
        test('succeeds with a valid person', async (done) => {
            const person = {
                name: 'Jane',
                number: 20000203,
            };
            const token = await helper.validToken();
            await api.post('/api/persons')
                .set('Authorization', 'bearer ' + token)
                .send(person)
                .expect(201);
            const phonebookAtEnd = await helper.personsInDb();
            const names = phonebookAtEnd.map(p => p.name);

            expect(phonebookAtEnd.length).toBe(helper.initialPhonebook.length + 1);
            expect(names).toContain('Jane');
            done();
        });

        test('fails with a person without name', async (done) => {
            const person = {
                number: 20000203,
            };
            const token = await helper.validToken();
            await api.post('/api/persons')
                .set('Authorization', 'bearer ' + token)
                .send(person)
                .expect(400);
            const phonebookAtEnd = await helper.personsInDb();

            expect(phonebookAtEnd.length).toBe(helper.initialPhonebook.length);
            done();
        });

        test('fails with a person without number', async (done) => {
            const person = {
                name: 'Jane',
            };
            const token = await helper.validToken();
            await api.post('/api/persons')
                .set('Authorization', 'bearer ' + token)
                .send(person)
                .expect(400);
            const phonebookAtEnd = await helper.personsInDb();

            expect(phonebookAtEnd.length).toBe(helper.initialPhonebook.length);
            done();
        });

        test('fails with a valid person with a invalid token', async (done) => {
            const person = {
                name: 'Jane',
                number: 20000203,
            };
            const token = helper.invalidToken();
            await api.post('/api/persons')
                .set('Authorization', 'bearer ' + token)
                .send(person)
                .expect(401);
            const phonebookAtEnd = await helper.personsInDb();

            expect(phonebookAtEnd.length).toBe(helper.initialPhonebook.length);
            done();
        });
    });

    describe('deleting a specific person', () => {
        test('succeeds with a valid id', async (done) => {
            const phonebookAtStart = await helper.personsInDb();
            const personToDelete = phonebookAtStart[0];
            const { status } = await api.delete(`/api/persons/${personToDelete.id}`);
            const phonebookAtEnd = await helper.personsInDb();

            expect(status).toBe(204);
            expect(phonebookAtEnd.length).toBe(helper.initialPhonebook.length - 1);
            done();
        });

        test('fails with statuscode 400 id is invalid ', async (done) => {
            await api.delete(`/api/persons/${helper.invalidId()}`).expect(400);
            done();
        });

        test('fails with statuscode 404 if person does not exist ', async (done) => {
            await api.delete(`/api/persons/${await helper.nonExistingId()}`).expect(404);
            done();
        });
    });

    describe('updating a specific person', () => {
        test('succeeds with a valid id', async (done) => {
            const person = {
                name: 'Jane',
                number: 20000202
            };
            const phonebookAtStart = await helper.personsInDb();
            const personToModify = phonebookAtStart[0];
            const { status } = await api.put(`/api/persons/${personToModify.id}`).send(person);
            const phonebookAtEnd = await helper.personsInDb();
            const names = phonebookAtEnd.map(p => p.name);
            const numbers = phonebookAtEnd.map(p => p.number);

            expect(status).toBe(200);
            expect(names).toContain(person.name);
            expect(numbers).toContain(person.number);
            done();
        });

        test('fails with statuscode 400 id is invalid ', async (done) => {
            await api.put(`/api/persons/${helper.invalidId()}`).expect(400);
            done();
        });

        test('fails with statuscode 404 if person does not exist ', async (done) => {
            await api.put(`/api/persons/${await helper.nonExistingId()}`).expect(404);
            done();
        });
    });
});

afterAll(() => {
    mongoose.connection.close();
});
