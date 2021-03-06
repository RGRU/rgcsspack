/*
 * Gulp-plugin работает в связке с gulp-rgswig
 * @author: rg team && nanomen
 *
 * На вход получает объект с данными, которые состоят из блоков сайта
 * Проходит по дереву, выбирая блоки и соответственные блоку стили
 * Путь до стилей собирает в массив
 * После собирает из полученного массива путей до стилей - sass файл, с импортами всех блоков
 * После того, как сохраняет sass файл в дирректорию стилей шаблона - включает gulp для сборки стиля из sass файла, в css
 * Полученный файл кладет в соответственную для шаблона папку
 *
 *
 */

/**
 * Объявляем модули,
 * с которыми будем работать
 *
 */

// Нормализация слешей в unix
const __pathDelimeter__ = '/'
const normalizeDelimeter = str => str.replace(/\\+/g, __pathDelimeter__)

// Для работы с файлами, путями, cli
const fs = require('fs')
const path = require('path')
const mkdirp = require('mkdirp')
const minimist = require('minimist')

// Выносим в отдельную функцию метод получения пути до файла
const getDirName = require('path').dirname

// Инструмент для создания плагина
const es = require('event-stream')

// Инструментарий
const _ = require('lodash')
const extendify = require('extendify') // Расширяет стандартный метод extend

// Подключаем для обработки sass файла во время сборки
const gulp = require('gulp')
const sass = require('gulp-sass')

/*
 * Настройка
 *
 */

// Расширяем возможности стандартного extend
_.extend = extendify({
  arrays: 'concat'
})

/*
 * Helpers
 *
 */

/**
 *
 * Получаем путь до базовых данных для шаблона
 * @param  {String} dirPath дирректория в которой лежит обрабатываемый gilp-ом файл
 * @return {String || null} возвращаем путь до данных, либо null
 *
 */
var findCrossData = function (dirPath) {
  // Сохраняем путь до дирректории в локальной переменной
  // Нужно для того, чтобы перезаписывать путь, если нам придется идти на уровни выше
  // Попутно нормализуя слеши для разных операционных систем
  var targetDir = normalizeDelimeter(dirPath)

  // Путь до файла с общими данными (будет ставится значение во время работы функции)
  var targetFile = null

  // Маска пути до файла с общими данными
  var crossData = `${__pathDelimeter__}crosspages${__pathDelimeter__}page.js`

  /**
   * Функции помощники
   *
   */

  /**
   *
   * Проверяет существует ли ресурс по данному пути
   * @param  {String} path путь до ресурса
   * @return {Boolean} возвращает true, если ресурс есть
   *
   */
  var resExistsSync = function (path) {
    try {
      fs.statSync(path)

      return true
    } catch (err) {
      return false
    }
  }

  /**
   * Получить путь до ресурса на уровень выше
   * @param  {String} path исходный путь
   * @return {String} путь на уровень выше
   */
  var parentDir = function (path) {
    return path.split(__pathDelimeter__).slice(0, -1).join(__pathDelimeter__)
  }

  /**
   *
   * Процесс поиска пути
   * до базовых данных
   *
   * Алгоритм: ищем данные crosspages/page в папке,
   * откуда берем кастомные данные
   * .../targetDir/ + /crosspages/page.js
   *
   * Если не находим, выходим выше targetDir
   *
   */

  // #1 Пытаемся найти базовые данные в папке с кастомным файлом данных
  targetFile = targetDir + crossData

  // #1.1 Ищем файл по этому пути
  // если не находим, идем выше
  if (resExistsSync(targetFile)) {
    // Если нашли, возвращаем путь
    return targetFile
  } else {
    // #2 Перенастраиваем папку
    // идем на два уровня выше от предыдущего,
    // сохраняя перед этим путь в переменную
    targetDir = parentDir(parentDir(targetDir))
    targetFile = targetDir + crossData

    // #2.1 Ищем файл по этому пути
    // если не находим, идем выше
    if (resExistsSync(targetFile)) {
      // Если нашли, возвращаем путь
      return targetFile
    } else {
      // #3 Перенастраиваем папку, еще на два уровня выше
      // это конечная папка, если в ней нет данных, то их нет больше нигде
      // сохраняя перед этим путь в переменную
      targetDir = parentDir(parentDir(targetDir))
      targetFile = `${targetDir}${__pathDelimeter__}data${crossData}`

      // #3.1 Ищем файл по этому пути
      if (resExistsSync(targetFile)) {
        // Если нашли, возвращаем путь
        return targetFile
      }
    }
  }

  return null
}

/*
 * Модуль плагина
 * Получает кастомные опции
 *
 */

module.exports = function (userOptions) {
  'use strict'

  /*
   * Настраиваем необходимые свойства
   *
   */

  var

    // Стандартые опции
    options = {

      // Название ключа со стилями у блока
      stylePathKey: 'stylesPath',

      // Стили, подключаемые во все шаблоны
      // автоматически
      coreStyles: {

        // Основные переменные
        common: 'common',

        // Глобальные стили
        global: {

          // Нормализация
          normalize: `global${__pathDelimeter__}normalize`,

          // Инструменты
          instruments: `global${__pathDelimeter__}instruments`,

          // Глобальные стили элементов
          elements: `global${__pathDelimeter__}elements`,

          // Модификаторы для блоков и элементов
          modify: `global${__pathDelimeter__}modify`

        },

        // Стили разметки
        layout: {

          // Основная страница
          page: `layouts${__pathDelimeter__}l-page`,

          // Боковой блок
          aside: `layouts${__pathDelimeter__}l-aside`

        },

        // Кастомизация вендоров
        vendors: {

          // Версия для печати
          print: `global${__pathDelimeter__}print`,

          // Colorbox
          colorbox: `vendors${__pathDelimeter__}vendor.colorbox.custom`,

          // Scrollbar
          scrollbar: `vendors${__pathDelimeter__}vendor.scrollbar.custom`,

          // Fotorama
          fotorama: `vendors${__pathDelimeter__}vendor.fotorama.custom`

        }

      }

    }

  // Обновляем стандартные опции с пользовательскими
  _.extend(options, userOptions)

  /**
   *
   * Функция плагина, которая принимает файловый поток в pipe
   * @param  {Buffer} file файл, который передается в gulp потоке
   * @param  {Function} callback функция обратного вызова
   * @return {Buffer} отправляем преобразованный файл дальше в потоке
   *
   */
  var rgcsspack = function (file, callback) {
    // Корневая дирректория проекта
    var rootPath = getRootPath(file.path)

    /*
     * Обрабатываемый файл
     */

    // Контент обрабатываемого файла
    var fileContents = file.contents

    // Путь до обрабатываемого файла
    var filePath = file.path

    // Имя обрабатываемого gulp-ом файла
    var fileName = null

    // Дирректория в которой лежит, обрабатываемый gulp-ом файл
    var dirPath = null

    /*
     * Файлы данных
     */

    // Файл общих данных
    var сrossDataFile = null

    // Файл кастомных данных
    var customDataFile = null

    // Результирующий файл с данными
    var dataFile = null

    /*
     * Файлы стилей
     */

    // Путь до sass файла
    // pathToSassFile = null,

    // Путь до временной папки для sass файла
    var pathToTempSassFile = null

    // Папка, куда будут записыватся стили,
    // в зависимости от окружения
    var envDir = null

    // Путь до файла стилей
    var pathToStyleFile = null

    // Карта стилей для инлайновых и общих
    var stylesMap = {
      inline: [],
      tofile: []
    }

    // Будущий контент для файла стилей
    var sassBufferToFile = null

    // Будущий контент для инлайн стилей
    var sassBufferToInline = null

    /**
     *
     * Функции помощники
     *
     */

    /**
     * Получаем путь до проекта вида: /var/www/.../
     * Связано с тем, что __dirname в данном случае указывает на папку node_modules
     * Поэтому получаем путь, просматривая путь до файла из потока
     *
     * Из строки вида /var/www/pathToProejct/src/data/file.js получаем /var/www/pathToProejct/src/
     *
     * @param  {String} filePath путь до обрабатываемого файла (в данном случае файл с данными file.js)
     * @return {String} возвращаем определенный нами путь, до папки проекта
     *
     */
    function getRootPath(filePath) {
      return filePath.split('src')[0]
    }

    /**
     * Определяем тип стиля,
     * базовый или кастомный
     * по наличию в пути до sass файла ключевого слова CUSTOM
     *
     * @param  {String} sassFilePath Путь до sass файла
     * @return {Boolean} возвращает true если это путь до кастомного стиля
     *
     */
    function checkHasCustom(filePath) {
      return /custom/.test(filePath)
    }

    /**
     * Нормализуем стили, которые идут в inline
     * и которые идут в файл
     *
     * Логика:
     *     Приоритетные стили в inline блоке,
     *     проверяем, если стили, которые есть в файле
     *     встречаются в inline блоке, то удаляем их из блока файлов
     *
     */
    function normalizeStyleMap() {
      // Создаем копию списка стилей для файла
      let stylesToFileList = stylesMap.tofile.slice(0)

      // Проходлим циклом по стилям,
      // которые есть в inline и удаляем такие в блоке для файлов
      stylesMap.inline.forEach(styleInline => {
        // Если пути до стиля совпадают, то удаляем
        _.remove(stylesToFileList, function (styleToFile) {
          return styleInline === styleToFile
        })
      })

      // Сохраняем отфильтрованный список
      stylesMap.tofile = stylesToFileList
    }

    /**
     * Собираем результирующий sass файл из всех стилей блоков,
     * которые фигурируют в обрабатываемом шаблоне
     *
     * @param  {String} stylesType тип обработки каких стилей
     * @return {String} возвращаем контент для создаваемого sass файла
     *
     */
    function createSassBuffer(stylesType) {
      let stylesList = stylesMap[stylesType]

      // Путь до папки со стилями
      let stylesPath = `${rootPath}src${__pathDelimeter__}styles${__pathDelimeter__}`

      // Путь до папки исходников проекта
      let srcPath = `${rootPath}src${__pathDelimeter__}`

      // Короткая запись до путей блоков
      let coreStyles = options.coreStyles

      // Будущий контент файла
      let content = ''

      // Фильтруем, оставляя уникальные стили
      stylesList = _.uniq(stylesList)

      // Передаем переменную окружения
      content += `$env: ${global.env}\n`

      // Подключаем common sass файл
      content += `@import ${stylesPath}${coreStyles.common}\n`

      // Если мы в инлайне
      if (stylesType === 'inline') {
        // Сначала заполняем дефолтными стилями, которые подключаются по-умолчанию
        // Их в последствии вынесем в тег head инлайном
        Object.keys(coreStyles).forEach(styleKey => {
          // Если это не вендоры (они должны быть в конце всех)
          // и не общие переменные, то
          // собираем стили
          if (styleKey !== 'vendors' && styleKey !== 'common') {
            // Если это объект,
            // то подключаем и его стили
            if (_.isObject(coreStyles[styleKey])) {
              Object.keys(coreStyles[styleKey]).forEach(style => {
                let path = (styleKey !== 'blocks') ? stylesPath : srcPath
                let value = coreStyles[styleKey][style]

                // Если есть значение
                if (!!value) {
                  content += `@import ${path}${value}\n`
                }
              })
            } else {
              let value = coreStyles[styleKey]

              // Если есть значение
              if (!!value) {
                // Если только стиль
                // подключаем его
                content += `@import ${stylesPath}${value}\n`
              }
            }
          }
        })
      }

      // Перебираем массив путей,
      // и конкатинируем их в наш контент
      stylesList.forEach(stylePath => {
        content += `@import ${stylePath}\n`
      })

      // Если мы не в инлайне
      if (stylesType !== 'inline') {
        // Стили кастомизации вендорных библиотек,
        // подключаются после всех стилей
        // Возможно от них можно как-то избавиться
        Object.keys(coreStyles.vendors).forEach(styleKey => {
          let value = coreStyles.vendors[styleKey]

          // Если есть значение
          if (!!value) {
            // Если только стиль
            // подключаем его
            content += `@import ${stylesPath}${value}\n`
          }
        })
      }

      // Убираем намес из разных слешей
      return normalizeDelimeter(content)
    }

    // Передаем в данные контент sass файла
    // чтобы можно было инлайном его обрабатывать дальше
    // в gulp потоке
    function createInlineStyles(sassBuffer) {
      // Данные, которые идут в gulp файле для сборки
      var contentObj = eval(String(fileContents)).toMerge

      // Sass компилятор подключаем так криво, данность архитектуры :(
      // require('/www/app/node_modules/gulp-sass/node_modules/node-sass')
      var sassCompiler = require('node-sass')

      // Результат компиляции
      var compilerResult = null

      // Компилируем стили
      compilerResult = sassCompiler.renderSync({
        data: sassBuffer,
        indentedSyntax: true,
        outputStyle: 'compressed'
      })

      // Получаем скомпилированные стили
      contentObj.styleData = String(compilerResult.css)

      // Получаем контент для файла, с добавленными стилями
      fileContents = new Buffer(JSON.stringify(contentObj))

      // добавляем контент в файл
      file.contents = fileContents
    }

    /**
     *
     * Функция поиска стилей в блоках
     * Блоки ищем в объекте, который получаем
     *
     * @param  {Object} obj объект с данными, в которых будем искать стили
     * @return {Undefined} ничего не возвращаем
     *
     */
    function findDeepKey(obj) {
      // Проходим по объекту в поисках стилей
      // используем рекурсию
      // Важно понимать, что функция работает только под определенную структуру данных RGB системы
      _.forEach(obj, (value, key) => {
        // #1
        // Проверяем, если в данных есть сортировка блоков,
        // то мы по ней будем подключать подблоки, входящие в просматриваемый блок
        // Проверяем соответственно по наличию самих параметров и свойства sortBlocks
        // Проверку осуществляем на уровне contents свойства,
        // чтобы можно было получить доступ до свойств самого родительского блока
        //
        // #2
        // Если в данных нет блока сортировки,
        // то переходим на проверку по наличию стилей. Подробнее ниже
        //
        // Вид данных:
        // {
        //      ...
        //      contents: [ Исторически сложилось, что это массив с одним объектом
        //          {
        //              ...
        //              stylesPath: {}, Объект со стилями
        //              ...
        //              param: {
        //                  ...
        //                  blocks: {}, Хеш мап всех блоков
        //                  ...
        //                  sortBlocks: {}, Хеш мап типов сортировки,
        //                                  в зависимости от модификатора (default сортировка по-умолчанию)
        //                  ...
        //              }
        //          }
        //      ]
        // }
        if (key === 'contents' && (!!value[0].param && !!value[0].param.sortBlocks)) {
          // Ссылка на объект свойств блока (тот, что является первым элементом массива)
          let rootBlock = value[0]

          // Ссылка на параметры
          let blockParam = null

          // Ссылка на блоки сортировки
          let sortBlockMap = null

          // Название модификатора,
          // по которому будем подключать из sortBlocks блоки
          let blockMod = null

          // Массив блоков для сортировки (по сути блоки, которые используются)
          let sortBlocks = null

          // Хеш мап всех блоков
          let blockList = null

          // Объект со стилями
          let rootStyle = null

          // Получаем все свойства
          blockParam = rootBlock.param
          rootStyle = rootBlock[options.stylePathKey]
          blockList = blockParam.blocks
          sortBlockMap = blockParam.sortBlocks
          blockMod = blockParam.mod

          // Получаем блоки для сортировки.
          // Если есть сортировка, соответствующая модификатору,
          // берем его.
          // Иначе берем дефолтный
          // Если и его нет, то увы :)
          sortBlocks = (!!sortBlockMap[blockMod]) ? sortBlockMap[blockMod] : sortBlockMap['default']

          // Преобразуем строку сортировки в массив блоков
          sortBlocks = sortBlocks.split(' ')

          // Помещаем стили родительского блока в список
          pushToStyleList(rootStyle)

          // Пробегаемся по используемым блокам в сортировке
          // И запускаем добавление стилей каждого блока сортировки
          _.forEach(sortBlocks, blockName => {
            let block = blockList[blockName]

            // Если такой блок существует
            if (!!block) {
              // Запускаем добавление стилей каждого блока сортировки
              // findDeepKey(_stylesList, block.opt.contents[0]);
              findDeepKey(block.opt)
            }
          })
        } else {
          // Если мы просматриваем объект
          // в котором хранятся стили
          // и он не пустой, то помещаем стили в список
          // иначе продолжаем искать объекты со стилями
          if (key === options.stylePathKey && !!value) {
            // Помещаем стили в список
            pushToStyleList(value)
          } else {
            // Если перед нами объект
            // и это не объект для rgtools, то запускаем поиск
            if (_.isObject(value) && key !== 'tools') {
              findDeepKey(value)
            }
          }
        }
      })
    }

    /**
     *
     * Функция добавления стилей в список
     * используется в функции findDeepKey
     * @param  {Array} styles массив с найденными стилями
     * @param  {Object} stylesData объект с стилями блока.
     *                             Свойства root - базовый стиль
     *                             Свойство custom - кастомный стиль
     * @return {Array} styles массив с найденными стилями
     *
     */
    function pushToStyleList(stylesData) {
      // Куда будем добавлять стили
      var stylesTarget = null

      // Базовый стиль
      var rootStyle = null

      // Стиль с модификатором
      var rootModStyle = null

      // Кастомный стиль
      var customStyle = null

      // Кастомный стиль с модификатором
      var customModStyle = null

      var styleInline = false

      // Если есть стили
      if (!!stylesData.paths) {
        // Проверяем, надо ли эти стили вставлять инлайном
        styleInline = stylesData.inline

        // Определяем контейнер для хранения стилей
        // в зависимости от styleInline
        if (styleInline) {
          // В массив инлайновых стилей
          stylesTarget = stylesMap.inline
        } else {
          // В массив общих стилей
          stylesTarget = stylesMap.tofile
        }

        // Базовый стиль
        rootStyle = stylesData.paths.root

        // Стиль с модификатором
        rootModStyle = stylesData.paths.rootMod

        // Кастомный стиль
        customStyle = stylesData.paths.custom

        // Кастомный стиль с модификатором
        customModStyle = stylesData.paths.customMod

        // Сначала проверяем Рут, чтобы каскад был правильный
        // Если есть базовый стиль, то помещаем его
        if (!!rootStyle) {
          stylesTarget.push(rootStyle.replace('.sass', ''))
        }

        // Проверяем на модификатор
        if (!!rootModStyle) {
          stylesTarget.push(rootModStyle.replace('.sass', ''))
        }

        // Проверяем на кастомный стиль
        if (!!customStyle) {
          stylesTarget.push(customStyle.replace('.sass', ''))
        }

        // Проверяем на кастомный модификатор
        if (!!customModStyle) {
          stylesTarget.push(customModStyle.replace('.sass', ''))
        }
      }
    }

    /**
     * Функция записи файла по пути
     * Дело в том, что node не сохраняет файл,
     * если папки не созданы до этого,
     * поэтому используем модуль, который автоматически их создает,
     * если их нет
     *
     * @param  {String} path футь сохраняемого файла
     * @param  {String} contents контент для файла
     * @param  {Function} callback обратный вызов, после создания файла
     * @return {Undefined} ничего не возвращает
     *
     */
    function writeFile(path, contents, callback) {
      // Используя модуль, создаем папки,
      // если они не были созданы ранее
      // Получаем названия всех папок которые нужно создать,
      // функция getDirName объявлена выше
      mkdirp(getDirName(path), function (err) {
        if (err) {
          return console.log(err)
        }

        // Как папки создали - записываем файл
        fs.writeFile(path, contents, callback)
      })
    }

    /**
     *
     * ОБработка потока
     *
     */
    try {
      // Получаем аргументы NODE процесса через minimist
      // Устанавливаем окружение
      // Как глобальную переменную в NODE
      global.env = minimist(process.argv).env || 'dev'

      // Определяем имя обрабатываемого файла
      // .../file.js -> file
      fileName = path.basename(filePath, '.js')

      // Определяем дирректорию в которой лежит файл
      // .../data/file.js -> .../data
      dirPath = path.dirname(filePath)

      /*
       *
       *  Получаем общие данные
       *  со всеми подключенными блоками в шаблоне
       *  Сохраняем их в один общий файл данных
       *
       */

      // Подключаем файл общих данных для шаблона
      // В нем лежат глобальные блоки страницы
      сrossDataFile = require(findCrossData(dirPath))

      // Подключаем файл с кастомными данными шаблона
      customDataFile = require(filePath).toMerge

      // Соединяем данные в один общий объект
      dataFile = _.extend({}, сrossDataFile, customDataFile)

      // Передаем в данные информацию об окружении
      dataFile = _.extend({}, dataFile, { env: global.env })

      /*
       *
       * Собираем файл из стилей,
       * которые соответствуют блокам,
       * используемым в полученном файле данных
       *
       */

      // Ищем стили у блоков
      // и заполняем ими массив стилей
      findDeepKey(dataFile)

      // Сортируем стили и удаляем дубли,
      // что идут в инлайн и в файл
      normalizeStyleMap()

      // Получаем контент для sass файла
      // передавая в функцию массив со списком стилей
      sassBufferToFile = createSassBuffer('tofile')

      // Получаем контент sass файла для инлайн стилей
      // передавая в функцию массив со списком стилей
      sassBufferToInline = createSassBuffer('inline')

      // Создаем стили из sass файла
      // и добавляем их в данные файла
      createInlineStyles(sassBufferToInline)

      /*
       *
       * Работа с файлом стилей
       *
       */

      // Устанавливаем папку, куда писать стили
      // в зависимости от окружения
      envDir = (global.env === 'dev') ? 'dest' : 'prod'

      // Устанавливаем путь временной папки,
      // куда писать sass файл
      pathToTempSassFile = `${rootPath}temp${__pathDelimeter__}styles${__pathDelimeter__}`

      // Устанавливаем путь, куда писать файл стилей
      pathToStyleFile = `${rootPath}${envDir}${__pathDelimeter__}public${__pathDelimeter__}styles${__pathDelimeter__}`

      // Если это кастомные файлы,
      // то изменяем пути
      if (checkHasCustom(filePath)) {
        // Устанавливаем путь, куда писать sass файл

        // Устанавливаем путь, куда писать временный sass файл
        // Попутно нормализуем слешщи путей
        pathToTempSassFile = `${rootPath}temp${__pathDelimeter__}styles${normalizeDelimeter(filePath).match(/\/custom\/[a-z0-9_-]+\/[a-z0-9_-]+\//)[0]}`

        // Устанавливаем путь, куда писать файл стилей
        // Попутно нормализуем слешщи путей
        pathToStyleFile = `${rootPath}${envDir}${__pathDelimeter__}public${__pathDelimeter__}styles${normalizeDelimeter(filePath).match(/\/custom\/[a-z0-9_-]+\/[a-z0-9_-]+\//)[0]}`
      }

      // Записываем файл во временную папку
      // temp folder
      writeFile(pathToTempSassFile + fileName + '.sass', sassBufferToFile, function (err) {
        if (err) {
          return console.log(err)
        }

        // Преобразуем sass файл в css,
        // запуская gulp обработку
        // Сохраняем в dest дирректорию
        gulp
          .src(pathToTempSassFile + fileName + '.sass')
          .pipe(sass({
            'outputStyle': 'compressed'
          }))
          .pipe(gulp.dest(pathToStyleFile))
      })

      /*
       *
       * Закончили
       *
       */

      // Отправляем данные
      callback(null, file)
    } catch (err) {
      // Отправляем ошибку
      callback(err)
    }
  }

  // Возвращаем данные
  return es.map(rgcsspack)
}
