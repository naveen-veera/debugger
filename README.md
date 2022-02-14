# EXAMLY-DEBUGGER

### Installation

Clone the repository

```sh
$ cd git
$ git clone -b malavan/inline-debugger https://malavanpalpandian@bitbucket.org/team-examly/examly-compiler.git
```
# Extract node on home directory for PM2 process
```sh
$ tar xf node-v6.9.5-linux-x64.tar.xz -C /home/ubuntu/
```
Install docker

```sh
$ sudo apt-get install docker.io
```
Install dependencies for docker image installation
```sh
$ sudo apt-get install autotools-dev
$ sudo apt-get install automake
```

Now install Docker images for all languages

## CPP
```sh
$ cd examly-compiler/DEBUGGER/v4-cokapi/backends/c_cpp 
$ sudo make
```

## Java
```sh
$ cd examly-compiler/DEBUGGER/v4-cokapi/backends/java 
$ sudo make
```

## Javascript
```sh
$ cd examly-compiler/DEBUGGER/v4-cokapi/backends/java 
$ sudo make
```

## Python
```sh
$ cd examly-compiler/DEBUGGER/v4-cokapi/backends/python-anaconda 
$ sudo make
```

## Ruby
```sh
$ cd examly-compiler/DEBUGGER/v4-cokapi/backends/ruby
$ sudo make
```
## Install dependencies for cokapi.js
```sh
$ cd examly-compiler/DEBUGGER/v4-cokapi
$ npm install --save
```
# Install PM2 on root
```sh
$ sudo -i
$ npm install -g pm2
```

# Start pm2 process
```sh
pm2 start /home/ubuntu/git/examly-compiler/DEBUGGER/v4-cokapi/cokapi.js --interpreter=/home/ubuntu/node-v6.9.5-linux-x64/bin/node
```
