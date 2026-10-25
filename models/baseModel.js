const { Op } = require('sequelize');

function convertFilter(filter = {}) {
    if (!filter || typeof filter !== 'object') return {};

    const where = {};
    for (const [key, val] of Object.entries(filter)) {
        if (key === '$or' && Array.isArray(val)) {
            where[Op.or] = val.map(f => convertFilter(f));
        } else if (key === '$and' && Array.isArray(val)) {
            where[Op.and] = val.map(f => convertFilter(f));
        } else if (key === '_id' || key === 'id') {
            where.id = val;
        } else if (val instanceof RegExp) {
            where[key] = { [Op.iRegexp]: val.source };
        } else if (val && typeof val === 'object') {
            if (val.$regex) {
                const pat = val.$regex instanceof RegExp ? val.$regex.source : val.$regex;
                where[key] = { [Op.iRegexp]: pat };
            } else if (val.$in) {
                where[key] = { [Op.in]: val.$in };
            } else if (val.$ne !== undefined) {
                where[key] = { [Op.ne]: val.$ne };
            } else if (val.$gt !== undefined) {
                where[key] = { [Op.gt]: val.$gt };
            } else if (val.$gte !== undefined) {
                where[key] = { [Op.gte]: val.$gte };
            } else if (val.$lt !== undefined) {
                where[key] = { [Op.lt]: val.$lt };
            } else if (val.$lte !== undefined) {
                where[key] = { [Op.lte]: val.$lte };
            } else {
                where[key] = val;
            }
        } else {
            where[key] = val;
        }
    }
    return where;
}

function attachMongooseCompatibility(Model) {
    // Add _id getter to instance prototype
    if (!Object.prototype.hasOwnProperty.call(Model.prototype, '_id')) {
        Object.defineProperty(Model.prototype, '_id', {
            get() {
                return this.id;
            },
            configurable: true
        });
    }

    // Ensure toJSON includes _id for frontend compatibility
    const origToJSON = Model.prototype.toJSON;
    Model.prototype.toJSON = function () {
        const values = origToJSON ? origToJSON.call(this) : { ...this.get() };
        if (values.id !== undefined && values._id === undefined) {
            values._id = values.id;
        }
        return values;
    };

    // Static: find
    Model.find = function (filter = {}) {
        const where = convertFilter(filter);
        let order = null;
        let limitVal = null;
        let offsetVal = null;

        const execute = async () => {
            const opts = { where };
            if (order) opts.order = order;
            if (limitVal) opts.limit = limitVal;
            if (offsetVal) opts.offset = offsetVal;
            return await Model.findAll(opts);
        };

        const queryObj = {
            sort(sortObj) {
                if (typeof sortObj === 'object' && sortObj !== null) {
                    order = Object.entries(sortObj).map(([k, dir]) => {
                        const field = k === '_id' ? 'id' : k;
                        return [field, dir === -1 || dir === 'desc' || dir === 'DESC' ? 'DESC' : 'ASC'];
                    });
                }
                return queryObj;
            },
            limit(n) {
                limitVal = n;
                return queryObj;
            },
            skip(n) {
                offsetVal = n;
                return queryObj;
            },
            then(resolve, reject) {
                return execute().then(resolve, reject);
            },
            catch(reject) {
                return execute().catch(reject);
            }
        };

        return queryObj;
    };

    // Static: findOne
    const origFindOne = Model.findOne.bind(Model);
    Model.findOne = async function (filter = {}) {
        if (filter && filter.where) {
            return await origFindOne(filter);
        }
        const where = convertFilter(filter);
        return await origFindOne({ where });
    };

    // Static: findById
    Model.findById = async function (id) {
        if (!id) return null;
        return await Model.findByPk(id);
    };

    // Static: findByIdAndUpdate
    Model.findByIdAndUpdate = async function (id, updateData, options = {}) {
        if (!id) return null;
        const record = await Model.findByPk(id);
        if (!record) return null;
        const cleanData = updateData && updateData.$set ? { ...updateData.$set } : { ...updateData };
        delete cleanData._id;
        delete cleanData.id;
        await record.update(cleanData);
        return record;
    };

    // Static: findByIdAndDelete
    Model.findByIdAndDelete = async function (id) {
        if (!id) return null;
        const record = await Model.findByPk(id);
        if (!record) return null;
        await record.destroy();
        return record;
    };

    // Static: findOneAndUpdate
    Model.findOneAndUpdate = async function (filter, updateData, options = {}) {
        const where = convertFilter(filter);
        let record = await Model.findOne({ where });
        const cleanData = updateData && updateData.$set ? { ...updateData.$set } : { ...updateData };
        delete cleanData._id;
        delete cleanData.id;

        if (record) {
            await record.update(cleanData);
            return record;
        } else if (options.upsert) {
            const createData = { ...where, ...cleanData };
            record = await Model.create(createData);
            return record;
        }
        return null;
    };

    // Static: deleteOne
    Model.deleteOne = async function (filter = {}) {
        const where = convertFilter(filter);
        const record = await Model.findOne({ where });
        if (record) {
            await record.destroy();
            return { deletedCount: 1 };
        }
        return { deletedCount: 0 };
    };

    // Static: deleteMany
    Model.deleteMany = async function (filter = {}) {
        const where = convertFilter(filter);
        const isTruncate = Object.keys(where).length === 0;
        return await Model.destroy({
            where,
            truncate: isTruncate,
            cascade: true,
            restartIdentity: isTruncate
        });
    };

    // Override Model.create to support bulk array seamlessly
    const origCreate = Model.create.bind(Model);
    Model.create = async function (data, options = {}) {
        if (Array.isArray(data)) {
            return await Model.bulkCreate(data, { returning: true, individualHooks: true, ...options });
        }
        return await origCreate(data, options);
    };

    return Model;
}

module.exports = { attachMongooseCompatibility, convertFilter };
