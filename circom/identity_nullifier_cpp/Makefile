CC=g++
CFLAGS=-std=c++11 -O3 -I.
DEPS_HPP = circom.hpp calcwit.hpp fr.hpp
DEPS_O = main.o calcwit.o fr.o 

all: identity_nullifier

%.o: %.cpp $(DEPS_HPP)
	$(CC) -Wno-address-of-packed-member -c $< $(CFLAGS)

identity_nullifier: $(DEPS_O) identity_nullifier.o
	$(CC) -o identity_nullifier *.o -lgmp 
